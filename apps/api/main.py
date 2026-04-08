"""FastAPI entrypoint: configurable LlamaIndex ReAct agent and SSE chat."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent import create_llm, create_react_agent
from app.chat_store import ChatSessionStore
from app.config import get_settings
from app.routes.agent_config import router as agent_config_router
from app.routes.chat import ENABLED_AGENT_TOOL_IDS, router as chat_router
from app.routes.clashes import router as clashes_router
from app.user_agent_config import default_config_path, load_user_agent_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    llm = create_llm(settings)
    agent = create_react_agent(settings, llm, tool_ids=ENABLED_AGENT_TOOL_IDS)
    store = ChatSessionStore(llm)

    cfg_path = (
        Path(settings.agent_user_config_path).expanduser().resolve()
        if settings.agent_user_config_path
        else default_config_path()
    )
    app.state.user_agent_config_path = cfg_path
    app.state.user_agent_config = load_user_agent_config(cfg_path)

    app.state.settings = settings
    app.state.llm = llm
    app.state.agent = agent
    app.state.chat_store = store

    yield


app = FastAPI(
    title="Balrog API",
    description="AI coordination backend with ReAct agent chat (SSE).",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(agent_config_router)
app.include_router(clashes_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
