"""
Ops Agent Bootstrap — 自动版本更新引导器

此文件替代各项目中的 ops_agent.py，负责：
1. 启动时从 Ops Center 拉取最新 ops_agent.py
2. 运行中每次心跳检查版本号，发现新版自动热更新
3. 拉取失败时降级使用本地缓存或内置保底版本

使用方法（与原 ops_agent.py 完全兼容）:
    from ops_agent import OpsClient  # 实际由 bootstrap 代理
    client = OpsClient(server=..., project_id=..., project_name=...)
    client.start()

或直接运行:
    python3 ops_agent.py  # 作为独立进程运行
"""
import os
import sys
import json
import time
import hashlib
import logging
import tempfile
import urllib.request
import urllib.error
import importlib.util

logger = logging.getLogger("ops-bootstrap")

# ── 配置 ──────────────────────────────────────────────────

# SDK 缓存目录（持久化，跨重启保留）
SDK_CACHE_DIR = os.environ.get("OPS_SDK_CACHE_DIR",
    os.path.join(tempfile.gettempdir(), "ops-sdk-cache"))

# 当前 bootstrap 版本（保底）
BOOTSTRAP_VERSION = "1.0.0"

# 检查更新的间隔（心跳次数），每 5 次心跳检查一次
UPDATE_CHECK_INTERVAL = 5


# ── 内置保底 SDK（最小可用版本） ──────────────────────────

_FALLBACK_SDK = '''
"""Ops Agent Fallback — 最小可用保底版本"""
import os, sys, json, time, socket, platform, threading, logging, urllib.request, urllib.error
from datetime import datetime
logger = logging.getLogger("ops-agent")

class OpsClient:
    def __init__(self, server, project_id, project_name, project_url="",
                 project_type="", version="", environment="", heartbeat_interval=60, timeout=10):
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
        self._process_start_time = 0
        self._thread = None
        self._running = False
        self._business_collectors = []
        self._total_requests = 0
        self._error_count = 0
        self._active_connections = 0
        self._queue_depth = 0
        self._sdk_version = "fallback"
        self._on_version_update = None

    def _collect_system(self):
        data = {"cpu_percent":0.0,"memory_mb":0.0,"memory_percent":0.0,"disk_mb":0.0,"disk_percent":0.0,"load_avg":[],"open_files":0,"threads":0,"uptime_seconds":int(time.time()-self._process_start_time)}
        try:
            with open("/proc/self/status","r") as f:
                for line in f:
                    if line.startswith("VmRSS:"): data["memory_mb"]=round(int(line.split()[1])/1024,1)
                    elif line.startswith("Threads:"): data["threads"]=int(line.split()[1])
            with open("/proc/meminfo","r") as f:
                mi={}
                for line in f:
                    p=line.split()
                    if len(p)>=2: mi[p[0].rstrip(":")]=int(p[1])
                t=mi.get("MemTotal",1); a=mi.get("MemAvailable",mi.get("MemFree",0))
                data["memory_percent"]=round((1-a/t)*100,1) if t>0 else 0.0
        except: pass
        try:
            st=os.statvfs("/"); t=st.f_blocks*st.f_frsize/(1024*1024); fr=st.f_bavail*st.f_frsize/(1024*1024)
            data["disk_mb"]=round(t-fr,1); data["disk_percent"]=round((1-fr/t)*100,1) if t>0 else 0.0
        except: pass
        try:
            with open("/proc/loadavg","r") as f: data["load_avg"]=[float(x) for x in f.readline().split()[:3]]
        except: pass
        return data

    def _collect_runtime(self):
        return {"total_requests":self._total_requests,"active_connections":self._active_connections,"error_count_last_hour":self._error_count,"avg_response_ms":0.0,"queue_depth":self._queue_depth}

    def _collect_business(self):
        b={}
        for c in self._business_collectors:
            try:
                r=c()
                if isinstance(r,dict): b.update(r)
            except: pass
        return b

    def _post(self, path, data):
        url=f"{self.server}{path}"
        payload=json.dumps(data,ensure_ascii=False).encode("utf-8")
        req=urllib.request.Request(url,data=payload,method="POST",headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8")
                return body, resp.status < 400
        except Exception as e:
            logger.debug(f"上报失败: {url} - {e}")
            return "", False

    def _get(self, path):
        url=f"{self.server}{path}"
        req=urllib.request.Request(url,method="GET")
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8")), True
        except Exception as e:
            logger.debug(f"GET失败: {url} - {e}")
            return {}, False

    def start(self):
        self._process_start_time=time.time(); self._running=True
        self._post("/api/ops/register",{"protocol":"ops-v1","project_id":self.project_id,"project_name":self.project_name,"project_url":self.project_url,"project_type":self.project_type,"version":self.version,"environment":self.environment,"hostname":socket.gethostname(),"ip":self._get_local_ip(),"platform":{"os":platform.system(),"python":platform.python_version(),"sdk_version":self._sdk_version},"started_at":self._started_at})
        logger.info(f"OpsClient registered: {self.project_name} (sdk={self._sdk_version})")
        self._thread=threading.Thread(target=self._heartbeat_loop,daemon=True); self._thread.start()

    def stop(self): self._running=False

    def snapshot(self, config=None, dependencies=None, endpoints=None, features=None, metadata=None):
        self._post("/api/ops/snapshot",{"project_id":self.project_id,"config":config or {},"dependencies":dependencies or [],"endpoints":endpoints or [],"features":features or [],"metadata":metadata or {}})

    def add_business_collector(self, func): self._business_collectors.append(func)

    def emit_event(self, event_type, level="info", message="", data=None):
        self._post("/api/ops/event",{"project_id":self.project_id,"event_type":event_type,"level":level,"message":message,"data":data or {},"timestamp":datetime.now().isoformat()})

    def emit_log(self, level, message, logger_name="", traceback=""):
        self._post("/api/ops/log",{"project_id":self.project_id,"level":level,"logger":logger_name,"message":message,"traceback":traceback,"timestamp":datetime.now().isoformat()})

    def set_runtime_metrics(self, total_requests=None, active_connections=None, error_count=None, avg_response_ms=None, queue_depth=None):
        if total_requests is not None: self._total_requests=total_requests
        if active_connections is not None: self._active_connections=active_connections
        if error_count is not None: self._error_count=error_count
        if queue_depth is not None: self._queue_depth=queue_depth

    def _heartbeat_loop(self):
        check_count = 0
        while self._running:
            try:
                system=self._collect_system()
                runtime=self._collect_runtime()
                business=self._collect_business()
                body, ok = self._post("/api/ops/heartbeat",{"project_id":self.project_id,"system":system,"runtime":runtime,"business":business})
                # 检查版本更新
                if ok and body:
                    try:
                        resp_data = json.loads(body) if isinstance(body, str) else body
                        latest = resp_data.get("latest_sdk_version", "")
                        if latest and latest != self._sdk_version:
                            check_count += 1
                            if check_count >= UPDATE_CHECK_INTERVAL:
                                check_count = 0
                                _try_hot_update(self.server, latest)
                    except: pass
            except Exception as e:
                logger.debug(f"心跳失败: {e}")
            for _ in range(self.heartbeat_interval):
                if not self._running: break
                time.sleep(1)

    @staticmethod
    def _get_local_ip():
        try:
            s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(("8.8.8.8",80)); ip=s.getsockname()[0]; s.close(); return ip
        except: return "127.0.0.1"

OpsAgent = OpsClient
'''


# ── SDK 下载与缓存 ────────────────────────────────────────

def _fetch_sdk(server: str) -> tuple:
    """从 Ops Center 下载最新 SDK

    Returns:
        (version, content) 或 (None, None)
    """
    url = f"{server.rstrip('/')}/api/ops/sdk/download"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            version = data.get("version", "")
            content = data.get("content", "")
            if version and content:
                return version, content
    except Exception as e:
        logger.warning(f"SDK 下载失败: {e}")
    return None, None


def _save_sdk_cache(version: str, content: str):
    """保存 SDK 到本地缓存"""
    try:
        os.makedirs(SDK_CACHE_DIR, exist_ok=True)
        cache_file = os.path.join(SDK_CACHE_DIR, f"ops_agent_v{version}.py")
        with open(cache_file, "w", encoding="utf-8") as f:
            f.write(content)
        # 更新 latest 指针
        latest_file = os.path.join(SDK_CACHE_DIR, "ops_agent_latest.py")
        with open(latest_file, "w", encoding="utf-8") as f:
            f.write(content)
        # 保存版本号
        ver_file = os.path.join(SDK_CACHE_DIR, "version.txt")
        with open(ver_file, "w") as f:
            f.write(version)
        logger.info(f"SDK 缓存已保存: v{version}")
    except Exception as e:
        logger.warning(f"SDK 缓存保存失败: {e}")


def _load_sdk_cache() -> tuple:
    """从本地缓存加载 SDK

    Returns:
        (version, content) 或 (None, None)
    """
    try:
        ver_file = os.path.join(SDK_CACHE_DIR, "version.txt")
        if not os.path.exists(ver_file):
            return None, None
        with open(ver_file, "r") as f:
            version = f.read().strip()
        latest_file = os.path.join(SDK_CACHE_DIR, "ops_agent_latest.py")
        if not os.path.exists(latest_file):
            return None, None
        with open(latest_file, "r", encoding="utf-8") as f:
            content = f.read()
        if version and content:
            logger.info(f"从缓存加载 SDK: v{version}")
            return version, content
    except Exception as e:
        logger.warning(f"SDK 缓存加载失败: {e}")
    return None, None


def _load_sdk_module(content: str, version: str):
    """将 SDK 源码加载为 Python 模块

    Args:
        content: Python 源码
        version: 版本号（用于模块名区分）

    Returns:
        加载的模块对象
    """
    # 写入临时文件
    tmp_dir = os.path.join(SDK_CACHE_DIR, "tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    tmp_file = os.path.join(tmp_dir, f"ops_agent_v{version}.py")
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(content)

    # 动态加载模块
    spec = importlib.util.spec_from_file_location("ops_agent_sdk", tmp_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _try_hot_update(server: str, latest_version: str):
    """尝试热更新 SDK（后台静默执行）"""
    try:
        version, content = _fetch_sdk(server)
        if version and content and version == latest_version:
            _save_sdk_cache(version, content)
            logger.info(f"SDK 热更新成功: v{version}")
    except Exception as e:
        logger.debug(f"SDK 热更新失败: {e}")


# ── 启动引导 ──────────────────────────────────────────────

def _bootstrap(server: str = None):
    """引导加载最新 SDK

    优先级: Ops Center 远程 > 本地缓存 > 内置保底

    Returns:
        (module, version) — 加载的 SDK 模块和版本号
    """
    # 1. 尝试从 Ops Center 拉取最新
    if server:
        version, content = _fetch_sdk(server)
        if version and content:
            _save_sdk_cache(version, content)
            try:
                module = _load_sdk_module(content, version)
                # 给模块注入版本号
                if hasattr(module, 'OpsClient'):
                    module.OpsClient._sdk_version = version
                logger.info(f"SDK 从远程加载: v{version}")
                return module, version
            except Exception as e:
                logger.warning(f"远程 SDK 加载失败，尝试缓存: {e}")

    # 2. 尝试从本地缓存加载
    version, content = _load_sdk_cache()
    if version and content:
        try:
            module = _load_sdk_module(content, version)
            if hasattr(module, 'OpsClient'):
                module.OpsClient._sdk_version = version
            logger.info(f"SDK 从缓存加载: v{version}")
            return module, version
        except Exception as e:
            logger.warning(f"缓存 SDK 加载失败，使用保底: {e}")

    # 3. 使用内置保底版本
    logger.warning("使用内置保底 SDK（功能受限）")
    tmp_dir = os.path.join(SDK_CACHE_DIR, "tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    tmp_file = os.path.join(tmp_dir, "ops_agent_fallback.py")
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(_FALLBACK_SDK)
    spec = importlib.util.spec_from_file_location("ops_agent_sdk", tmp_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if hasattr(module, 'OpsClient'):
        module.OpsClient._sdk_version = "fallback"
    return module, "fallback"


# ── 执行引导，暴露与原 ops_agent.py 相同的接口 ───────────

_sdk_module, _sdk_version = _bootstrap()

# 将 SDK 模块的所有公开属性暴露到当前模块命名空间
# 这样 `from ops_agent import OpsClient` 仍然有效
OpsClient = getattr(_sdk_module, 'OpsClient', None)
OpsAgent = getattr(_sdk_module, 'OpsAgent', None)
init = getattr(_sdk_module, 'init', None)
report_metric = getattr(_sdk_module, 'report_metric', None)
report_event = getattr(_sdk_module, 'report_event', None)

logger.info(f"Ops Agent Bootstrap 完成, SDK v{_sdk_version}")


# ── 独立运行模式（python3 ops_agent.py） ──────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ops Agent Bootstrap")
    parser.add_argument("--server", default=os.environ.get("OPS_SERVER", ""), help="Ops Center URL")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--project-name", default="", help="Project name")
    parser.add_argument("--project-url", default="", help="Project URL")
    parser.add_argument("--project-type", default="hf_docker", help="Project type")
    parser.add_argument("--version", default="", help="Project version")
    parser.add_argument("--env", default="production", help="Environment")
    parser.add_argument("--heartbeat", type=int, default=120, help="Heartbeat interval (seconds)")
    args = parser.parse_args()

    if OpsClient:
        client = OpsClient(
            server=args.server,
            project_id=args.project_id,
            project_name=args.project_name,
            project_url=args.project_url,
            project_type=args.project_type,
            version=args.version,
            environment=args.env,
            heartbeat_interval=args.heartbeat,
        )
        client.start()
        logger.info(f"Ops Agent 运行中 (sdk={_sdk_version})...")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            client.stop()
    else:
        logger.error("SDK 加载失败，无法启动")
        sys.exit(1)
