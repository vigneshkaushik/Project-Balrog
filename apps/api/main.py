"""FastAPI entrypoint: configurable LlamaIndex ReAct agent and SSE chat."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent import create_llm, create_react_agent
from app.chat_store import ChatSessionStore
from app.config import get_settings
from app.routes.chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    llm = create_llm(settings)
    agent = create_react_agent(settings, llm)
    store = ChatSessionStore(llm)

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
