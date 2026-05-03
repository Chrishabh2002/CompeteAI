"""
CompeteAI — Vercel Serverless Entry Point
Wraps the FastAPI app for Vercel's Python runtime.
All routes are served under /api/ prefix.
"""

import sys
import os

# Add the project root to Python path so all imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now import the FastAPI app
from main import app

# Vercel expects the ASGI app to be named "app" or "handler"
# The FastAPI app is already ASGI-compatible
