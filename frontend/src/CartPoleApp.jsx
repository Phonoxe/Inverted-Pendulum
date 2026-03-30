import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:8000/ws";

const W = 960;
const H = 460;
const TRACK_Y = 220;
const PIXELS_PER_METER = 80;
const CART_W = 72;
const CART_H = 28;
const WHEEL_R = 12;
const POLE_LENGTH_PX = 150;
const RULER_SPACING = PIXELS_PER_METER * 0.5;
const RULER_LABEL_EVERY = 2;

function toScreenX(x) {
  return W / 2 + x * PIXELS_PER_METER;
}

function drawScene(ctx, state, connected, mouse) {
  const { x, theta, omega, step } = state;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, W, H);

  // Scanlines
  ctx.strokeStyle = "rgba(255,255,255,0.015)";
  ctx.lineWidth = 1;
  for (let sy = 0; sy < H; sy += 4) {
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }

  // Ruler
  const rulerY = TRACK_Y + WHEEL_R + 18;
  const ticksLeft = Math.ceil((W / 2) / RULER_SPACING) + 1;
  ctx.font = "11px 'DM Mono', monospace";
  ctx.textAlign = "center";
  for (let i = -ticksLeft; i <= ticksLeft; i++) {
    const worldM = i * 0.5;
    const sx = toScreenX(worldM);
    const isMajor = i % RULER_LABEL_EVERY === 0;
    const tickH = isMajor ? 10 : 5;
    ctx.strokeStyle = isMajor ? "rgba(255,80,60,0.7)" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, rulerY);
    ctx.lineTo(sx, rulerY + tickH);
    ctx.stroke();
    if (isMajor) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(String(Math.round(worldM * 2) / 2 * 100), sx, rulerY + tickH + 14);
    }
  }
  ctx.fillStyle = "rgba(255,80,60,0.5)";
  ctx.font = "bold 11px 'DM Mono', monospace";
  ctx.fillText("0", toScreenX(0), rulerY + 24);

  // Track rail
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(30, TRACK_Y - 6, W - 60, 12, 6);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.beginPath();
  ctx.roundRect(32, TRACK_Y - 4, W - 64, 8, 4);
  ctx.fill();

  // Cart
  const cx = toScreenX(x);
  const cartTop = TRACK_Y - CART_H / 2;

  // Wheels
  [-26, 26].forEach(off => {
    const wx = cx + off;
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(wx, TRACK_Y, WHEEL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(wx, TRACK_Y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let sp = 0; sp < 4; sp++) {
      const a = sp * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(a) * 4, TRACK_Y + Math.sin(a) * 4);
      ctx.lineTo(wx + Math.cos(a) * (WHEEL_R - 2), TRACK_Y + Math.sin(a) * (WHEEL_R - 2));
      ctx.stroke();
    }
  });

  // Cart body
  ctx.fillStyle = "#2e2e2e";
  ctx.beginPath();
  ctx.roundRect(cx - CART_W / 2, cartTop, CART_W, CART_H, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pivot dot
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(cx, TRACK_Y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Pole — hangs DOWN at rest (theta=0 → straight down)
  const tipX = cx + Math.sin(theta) * POLE_LENGTH_PX;
  const tipY = TRACK_Y + Math.cos(theta) * POLE_LENGTH_PX;

  // Colour: white when hanging straight down, red when near upright
  const deviation = Math.abs(((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
  const danger = Math.min(1, deviation / 90);
  const pr = 255;
  const pg = Math.round(255 - 200 * danger);
  const pb = Math.round(255 - 240 * danger);
  const poleColor = `rgb(${pr},${pg},${pb})`;

  ctx.strokeStyle = poleColor;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, TRACK_Y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Bob
  ctx.fillStyle = poleColor;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mouse target indicator
  if (mouse?.active) {
    const tx = toScreenX(mouse.worldX);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, TRACK_Y - 32);
    ctx.lineTo(tx, TRACK_Y + 32);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(tx, TRACK_Y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  ctx.font = "12px 'DM Mono', monospace";
  ctx.textAlign = "left";
  const hudLines = [
    ["step", String(step).padStart(4, "0")],
    ["θ   ", `${(theta * 180 / Math.PI).toFixed(1)}°`],
    ["ω   ", `${omega.toFixed(2)} r/s`],
    ["x   ", `${x.toFixed(2)} m`],
  ];
  hudLines.forEach(([label, val], i) => {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText(label, 20, 28 + i * 20);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(val, 68, 28 + i * 20);
  });

  if (!connected) {
    ctx.fillStyle = "rgba(255,80,60,0.9)";
    ctx.font = "13px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("connecting to server…", W / 2, 24);
  }
}

export default function CartPoleApp() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  // mouse.worldX = cursor position in world coords, active = button held
  const mouseRef = useRef({ active: false, worldX: 0 });
  const stateRef = useRef({ x: 0, v_cart: 0, theta: 0.05, omega: 0, step: 0, done: false });
  const animRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("disconnected");

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen  = () => { setConnected(true);  setStatus("connected"); };
    ws.onmessage = (e) => { stateRef.current = JSON.parse(e.data); };
    ws.onclose = () => { setConnected(false); setStatus("disconnected"); };
    ws.onerror = () => { setStatus("error"); };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let last = performance.now();

    function loop(now) {
      const dt = now - last;
      if (dt >= 20) {
        last = now;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          let action = 0;
          if (mouseRef.current.active) {
            // Proportional control: error in world metres → action in [-1, 1]
            // GAIN=1 means 1 m of separation = full speed.
            // The cart smoothly decelerates as it approaches the target.
            const GAIN = 1.0;
            const error = mouseRef.current.worldX - stateRef.current.x;
            action = Math.max(-1, Math.min(1, error * GAIN));
          }
          wsRef.current.send(JSON.stringify({ action }));
        }
      }
      drawScene(ctx, stateRef.current, connected, mouseRef.current);
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [connected]);

  // Mouse / touch tracking
  useEffect(() => {
    const canvas = canvasRef.current;

    const toWorldX = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const canvasX = (clientX - rect.left) * (W / rect.width);
      return (canvasX - W / 2) / PIXELS_PER_METER;
    };

    const onMove  = (e) => { mouseRef.current.worldX = toWorldX(e.clientX); };
    const onDown  = (e) => { mouseRef.current.active = true;  mouseRef.current.worldX = toWorldX(e.clientX); };
    const onUp    = ()  => { mouseRef.current.active = false; };

    const onTouchMove  = (e) => { e.preventDefault(); mouseRef.current.worldX = toWorldX(e.touches[0].clientX); };
    const onTouchStart = (e) => { e.preventDefault(); mouseRef.current.active = true; mouseRef.current.worldX = toWorldX(e.touches[0].clientX); };
    const onTouchEnd   = ()  => { mouseRef.current.active = false; };

    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mousedown",  onDown);
    window.addEventListener("mouseup",    onUp);
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchend",   onTouchEnd);

    return () => {
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mousedown",  onDown);
      window.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  useEffect(() => { connect(); }, [connect]);

  const statusColor = { connected: "#7af", disconnected: "#f77", connecting: "#fa7", error: "#f77" }[status];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Mono', monospace",
      gap: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>

      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 400, letterSpacing: "0.15em", margin: 0, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" }}>
          CartPole
        </h1>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.1em" }}>NEAT / manual</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}/>
          <span style={{ color: statusColor, fontSize: 11 }}>{status}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          display: "block",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "#1a1a1a",
          maxWidth: "100%",
          cursor: "crosshair",
        }}
      />

      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.06em" }}>
          click and drag to move the cart
        </span>
        <button onClick={connect} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
          color: "rgba(255,255,255,0.4)", padding: "6px 14px", fontSize: 11,
          letterSpacing: "0.1em", cursor: "pointer", fontFamily: "'DM Mono', monospace", textTransform: "uppercase",
        }}>
          reconnect
        </button>
      </div>
    </div>
  );
}