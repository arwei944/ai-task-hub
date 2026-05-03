"""
Ops Agent for AI Task Hub - Ops Protocol v1.0
独立后台运行，上报系统状态到 Ops Center
"""
import os
import sys
import json
import time
import socket
import platform
import threading
import logging
import urllib.request
import urllib.error
from datetime import datetime

logger = logging.getLogger("ops-agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


class OpsClient:
    def __init__(self, server, project_id, project_name, project_url="",
                 project_type="", version="", environment="", heartbeat_interval=120, timeout=10):
        self.server = server.rstrip("/")
        self.project_id = project_id
        self.project_name = project_name
        self.project_url = project_url
        self.project_type = project_type
        self.version = version
        self.environment = environment
        self.heartbeat_interval = heartbeat_interval
        self.timeout = timeout
        self._started_at = datetime.now().isoformat()
        self._process_start_time = time.time()
        self._running = False

    def _collect_system(self):
        data = {"cpu_percent": 0.0, "memory_mb": 0.0, "memory_percent": 0.0,
                "disk_mb": 0.0, "disk_percent": 0.0, "load_avg": [],
                "open_files": 0, "threads": 0,
                "uptime_seconds": int(time.time() - self._process_start_time)}
        try:
            with open("/proc/stat", "r") as f:
                vals = list(map(int, f.readline().split()[1:8]))
            time.sleep(0.1)
            with open("/proc/stat", "r") as f:
                vals2 = list(map(int, f.readline().split()[1:8]))
            d_idle = vals2[3] - vals[3]
            d_total = sum(v2 - v for v, v2 in zip(vals, vals2))
            if d_total > 0:
                data["cpu_percent"] = round((1 - d_idle / d_total) * 100, 1)
        except Exception:
            pass
        try:
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        data["memory_mb"] = round(int(line.split()[1]) / 1024, 1)
                    elif line.startswith("Threads:"):
                        data["threads"] = int(line.split()[1])
            with open("/proc/meminfo", "r") as f:
                meminfo = {}
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        meminfo[parts[0].rstrip(":")] = int(parts[1])
                total = meminfo.get("MemTotal", 1)
                available = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
                data["memory_percent"] = round((1 - available / total) * 100, 1) if total > 0 else 0.0
        except Exception:
            pass
        try:
            stat = os.statvfs("/")
            total = stat.f_blocks * stat.f_frsize / (1024 * 1024)
            free = stat.f_bavail * stat.f_frsize / (1024 * 1024)
            data["disk_mb"] = round(total - free, 1)
            data["disk_percent"] = round((1 - free / total) * 100, 1) if total > 0 else 0.0
        except Exception:
            pass
        try:
            with open("/proc/loadavg", "r") as f:
                data["load_avg"] = [float(x) for x in f.readline().split()[:3]]
        except Exception:
            pass
        try:
            data["open_files"] = len(os.listdir("/proc/self/fd"))
        except Exception:
            pass
        return data

    def _post(self, path, data):
        url = f"{self.server}{path}"
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST",
                                      headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status < 400
        except Exception as e:
            logger.debug(f"上报失败: {url} - {e}")
            return False

    def _get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def start(self):
        self._process_start_time = time.time()
        self._running = True
        register_data = {
            "protocol": "ops-v1",
            "project_id": self.project_id,
            "project_name": self.project_name,
            "project_url": self.project_url,
            "project_type": self.project_type,
            "version": self.version,
            "environment": self.environment,
            "hostname": socket.gethostname(),
            "ip": self._get_local_ip(),
            "platform": {"os": platform.system(), "python": platform.python_version(),
                         "framework": "Next.js", "sdk": "docker"},
            "started_at": self._started_at,
        }
        self._post("/api/ops/register", register_data)
        logger.info(f"OpsClient registered: {self.project_name} ({self.project_id})")

        # Send snapshot
        snapshot_data = {
            "project_id": self.project_id,
            "config": {"port": os.environ.get("PORT", "7860"), "node_env": os.environ.get("NODE_ENV", "production")},
            "dependencies": [{"name": "next", "version": "14.x"}, {"name": "better-sqlite3", "version": "native"},
                              {"name": "prisma", "version": "latest"}],
            "endpoints": [{"path": "/", "method": "GET", "description": "Main page"},
                          {"path": "/api", "method": "GET", "description": "API routes"}],
            "features": ["task_management", "mcp_server", "ai_integration", "sqlite_storage"],
            "metadata": {"runtime": "node.js", "database": "sqlite"},
        }
        self._post("/api/ops/snapshot", snapshot_data)
        logger.info(f"Snapshot sent: {self.project_id}")

        # Start heartbeat
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()
        logger.info(f"Heartbeat started, interval {self.heartbeat_interval}s")

    def _heartbeat_loop(self):
        while self._running:
            try:
                system = self._collect_system()
                heartbeat_data = {
                    "project_id": self.project_id,
                    "system": system,
                    "runtime": {"total_requests": 0, "active_connections": 0, "error_count_last_hour": 0},
                    "business": {},
                }
                self._post("/api/ops/heartbeat", heartbeat_data)
            except Exception as e:
                logger.debug(f"Heartbeat failed: {e}")
            for _ in range(self.heartbeat_interval):
                if not self._running:
                    break
                time.sleep(1)

    def stop(self):
        self._running = False


if __name__ == "__main__":
    server = os.environ.get("OPS_SERVER", "https://arwei944-ops-center.hf.space")
    client = OpsClient(
        server=server,
        project_id="ai-task-hub",
        project_name="AI Task Hub",
        project_url="https://github.com/arwei944/ai-task-hub",
        project_type="hf_docker",
        version="3.1.0",
        environment="production",
        heartbeat_interval=120,
    )
    client.start()
    logger.info("Ops Agent running in background...")
    # Keep main thread alive
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        client.stop()
