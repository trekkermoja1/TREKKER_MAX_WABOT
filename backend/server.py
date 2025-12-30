"""
TREKKER MAX WABOT - Backend Server
Multi-Instance WhatsApp Bot Platform
"""
import os
import subprocess
import uuid
import json
import asyncio
import signal
from datetime import datetime
from typing import Optional, Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

# Database setup (using local JSON file for simplicity and to unblock UI)
DB_FILE = "instances.json"

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f)

# Bot instances tracking
bot_processes: Dict[str, subprocess.Popen] = {}
instance_ports: Dict[str, int] = {}
port_counter = 4000  # Starting port for bot instances


# Pydantic models
class CreateInstanceRequest(BaseModel):
    name: str
    phone_number: str
    owner_id: Optional[str] = None


class InstanceResponse(BaseModel):
    id: str
    name: str
    phone_number: str
    status: str
    created_at: str
    pairing_code: Optional[str] = None
    connected_user: Optional[dict] = None


async def cleanup_instances():
    """Cleanup running bot processes on shutdown"""
    for instance_id, process in bot_processes.items():
        try:
            process.terminate()
            process.wait(timeout=5)
        except:
            process.kill()
    bot_processes.clear()
    instance_ports.clear()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 TREKKER MAX WABOT Backend Starting...")
    # Restore running instances from local DB
    data = load_db()
    for instance_id, instance in data.items():
        if instance.get("status") == "running":
            instance["status"] = "stopped"
    save_db(data)
    yield
    # Shutdown
    await cleanup_instances()
    print("👋 TREKKER MAX WABOT Backend Shutting Down...")


app = FastAPI(
    title="TREKKER MAX WABOT",
    description="Multi-Instance WhatsApp Bot Platform powered by Trekker",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "TREKKER MAX WABOT API is running"}


def get_next_port():
    """Get next available port for bot instance"""
    global port_counter
    port_counter += 1
    return port_counter


async def get_instance_status(instance_id: str, port: int) -> dict:
    """Get status from running bot instance"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://localhost:{port}/status")
            return response.json()
    except:
        return {"status": "offline", "pairingCode": None}


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TREKKER MAX WABOT",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/instances", response_model=InstanceResponse)
async def create_instance(request: CreateInstanceRequest):
    """Create a new bot instance"""
    instance_id = str(uuid.uuid4())[:8]
    port = get_next_port()
    
    instance_data = {
        "id": instance_id,
        "name": request.name,
        "phone_number": request.phone_number,
        "owner_id": request.owner_id,
        "status": "starting",
        "port": port,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    data = load_db()
    data[instance_id] = instance_data
    save_db(data)
    
    # Start the bot instance in background to avoid timeout
    bot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bot')
    process = subprocess.Popen(
        ['node', 'instance.js', instance_id, request.phone_number, str(port)],
        cwd=bot_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    bot_processes[instance_id] = process
    instance_ports[instance_id] = port
    
    data = load_db()
    data[instance_id]["status"] = "starting"
    data[instance_id]["pid"] = process.pid
    save_db(data)
    
    return InstanceResponse(
        id=instance_id,
        name=request.name,
        phone_number=request.phone_number,
        status="starting",
        created_at=instance_data["created_at"],
        pairing_code=None
    )


@app.get("/api/instances")
async def list_instances():
    """List all bot instances"""
    instances = []
    data = load_db()
    for instance_id, instance in data.items():
        port = instance.get("port")
        
        # Get live status if instance is supposed to be running
        status_data = {"status": instance.get("status", "unknown")}
        if port and instance_id in bot_processes:
            status_data = await get_instance_status(instance_id, port)
        
        instances.append({
            "id": instance_id,
            "name": instance.get("name", "Unknown"),
            "phone_number": instance.get("phone_number", ""),
            "status": status_data.get("status", instance.get("status")),
            "pairing_code": status_data.get("pairingCode"),
            "connected_user": status_data.get("user"),
            "created_at": instance.get("created_at", ""),
        })
    
    return {"instances": instances, "total": len(instances)}


@app.get("/api/instances/{instance_id}")
async def get_instance(instance_id: str):
    """Get details of a specific instance"""
    data = load_db()
    instance = data.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    port = instance.get("port")
    status_data = {"status": instance.get("status")}
    
    if port and instance_id in bot_processes:
        status_data = await get_instance_status(instance_id, port)
    
    return {
        "id": instance_id,
        "name": instance.get("name"),
        "phone_number": instance.get("phone_number"),
        "status": status_data.get("status", instance.get("status")),
        "pairing_code": status_data.get("pairingCode"),
        "connected_user": status_data.get("user"),
        "created_at": instance.get("created_at"),
    }


@app.get("/api/instances/{instance_id}/pairing-code")
async def get_pairing_code(instance_id: str):
    """Get pairing code for an instance"""
    data = load_db()
    instance = data.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    port = instance.get("port")
    if not port or instance_id not in bot_processes:
        raise HTTPException(status_code=400, detail="Instance not running")
    
    status_data = await get_instance_status(instance_id, port)
    
    return {
        "instance_id": instance_id,
        "pairing_code": status_data.get("pairingCode"),
        "pairing_code_valid": status_data.get("pairingCodeValid", False),
        "pairing_code_remaining_seconds": status_data.get("pairingCodeRemainingSeconds", 0),
        "pairing_code_expires_at": status_data.get("pairingCodeExpiresAt"),
        "status": status_data.get("status")
    }


@app.post("/api/instances/{instance_id}/start")
async def start_instance(instance_id: str):
    """Start a stopped instance"""
    data = load_db()
    instance = data.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    if instance_id in bot_processes:
        return {"message": "Instance already running", "instance_id": instance_id}
    
    port = instance.get("port") or get_next_port()
    
    try:
        bot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bot')
        process = subprocess.Popen(
            ['node', 'instance.js', instance_id, instance.get("phone_number", ""), str(port)],
            cwd=bot_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        bot_processes[instance_id] = process
        instance_ports[instance_id] = port
        
        data[instance_id]["status"] = "running"
        data[instance_id]["port"] = port
        data[instance_id]["pid"] = process.pid
        save_db(data)
        
        return {"message": "Instance started", "instance_id": instance_id, "port": port}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start instance: {str(e)}")


@app.post("/api/instances/{instance_id}/stop")
async def stop_instance(instance_id: str):
    """Stop a running instance"""
    if instance_id not in bot_processes:
        raise HTTPException(status_code=400, detail="Instance not running")
    
    try:
        process = bot_processes[instance_id]
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        
        del bot_processes[instance_id]
        if instance_id in instance_ports:
            del instance_ports[instance_id]
        
        data = load_db()
        data[instance_id]["status"] = "stopped"
        save_db(data)
        
        return {"message": "Instance stopped", "instance_id": instance_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop instance: {str(e)}")


@app.delete("/api/instances/{instance_id}")
async def delete_instance(instance_id: str):
    """Delete an instance"""
    data = load_db()
    instance = data.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Stop if running
    if instance_id in bot_processes:
        try:
            process = bot_processes[instance_id]
            process.terminate()
            process.wait(timeout=5)
        except:
            pass
        del bot_processes[instance_id]
        if instance_id in instance_ports:
            del instance_ports[instance_id]
    
    # Delete instance directory
    import shutil
    bot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bot', 'instances', instance_id)
    if os.path.exists(bot_dir):
        shutil.rmtree(bot_dir)
    
    # Delete from database
    del data[instance_id]
    save_db(data)
    
    return {"message": "Instance deleted", "instance_id": instance_id}


@app.post("/api/instances/{instance_id}/restart")
async def restart_instance(instance_id: str):
    """Restart an instance"""
    # Stop if running
    if instance_id in bot_processes:
        await stop_instance(instance_id)
        await asyncio.sleep(2)
    
    # Start again
    return await start_instance(instance_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
