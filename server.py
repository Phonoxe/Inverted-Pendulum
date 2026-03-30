import math
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from env import CartPoleEnv

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

env = CartPoleEnv()


@app.get("/reset")
def reset():
    state = env.reset()
    x, v_cart, theta, omega = state
    return {
        "x": x,
        "v_cart": v_cart,
        "theta": theta,
        "omega": omega,
        "step": env.step_count,
        "done": env.done,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    env.reset()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if "x" in msg:
                # Manual mouse mode: client sends target x in world coords.
                # We set the cart position directly and derive velocity so the
                # pendulum coupling still works correctly.
                prev_x = env.x
                env.x = float(msg["x"])
                prev_v = env.v_cart
                env.v_cart = (env.x - prev_x) / env.DT
                a_cart = (env.v_cart - prev_v) / env.DT

                alpha = -(env.G / env.POLE_LENGTH) * math.sin(env.theta) - (
                    a_cart / env.POLE_LENGTH
                ) * math.cos(env.theta)
                env.omega += alpha * env.DT
                env.theta += env.omega * env.DT
                env.step_count += 1
                env.done = env.step_count >= env.max_steps
            else:
                # Agent mode: action in [-1, 1]
                action = max(-1.0, min(1.0, float(msg.get("action", 0.0))))
                env.step(action)

            x, v_cart, theta, omega = env._get_state()
            await websocket.send_text(
                json.dumps(
                    {
                        "x": round(x, 4),
                        "v_cart": round(v_cart, 4),
                        "theta": round(theta, 4),
                        "omega": round(omega, 4),
                        "step": env.step_count,
                        "done": env.done,
                    }
                )
            )

            if env.done:
                env.reset()

    except WebSocketDisconnect:
        pass
