const BASE_WIDTH = 794;
const BASE_HEIGHT = 1123;

export class PageCanvas {
  constructor(canvas, page, onChange) {
    this.canvas = canvas;
    this.page = page;
    this.onChange = onChange;
    this.ctx = canvas.getContext("2d");
    this.drawing = false;
    this.currentStroke = null;
    this.mode = "draw";
    this.color = "#222222";
    this.size = 3;
    this.undoStack = [];
    this.redoStack = [];
    this.pointerId = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.bindEvents();
    this.resize();
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => this.start(event));
    this.canvas.addEventListener("pointermove", (event) => this.move(event));
    this.canvas.addEventListener("pointerup", (event) => this.end(event));
    this.canvas.addEventListener("pointercancel", (event) => this.end(event));
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  setTool(mode) {
    this.mode = mode;
    this.canvas.style.cursor = mode === "erase" ? "cell" : "crosshair";
  }

  setColor(color) {
    this.color = color;
    this.setTool("draw");
  }

  setSize(size) {
    this.size = Number(size);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);

    this.ctx.setTransform(
      (rect.width / BASE_WIDTH) * dpr,
      0,
      0,
      (rect.height / BASE_HEIGHT) * dpr,
      0,
      0
    );

    this.render();
  }

  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * BASE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT,
      pressure: event.pressure > 0 ? event.pressure : 0.5
    };
  }

  start(event) {
    if (event.button !== undefined && event.button !== 0) return;

    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    this.drawing = true;

    this.undoStack.push(structuredClone(this.page.strokes));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];

    const p = this.getPoint(event);
    this.currentStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mode: this.mode,
      color: this.color,
      size: this.size,
      points: [p]
    };
    this.page.strokes.push(this.currentStroke);
    this.render();
  }

  move(event) {
    if (!this.drawing || event.pointerId !== this.pointerId) return;
    event.preventDefault();

    const p = this.getPoint(event);
    const points = this.currentStroke.points;
    const last = points[points.length - 1];

    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;

    points.push(p);
    this.render();
  }

  end(event) {
    if (!this.drawing || event.pointerId !== this.pointerId) return;

    this.drawing = false;
    this.pointerId = null;
    this.currentStroke = null;
    this.page.updatedAt = new Date().toISOString();
    this.onChange?.();
  }

  drawStroke(stroke) {
    if (!stroke.points?.length) return;

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.lineWidth = stroke.size || 3;

    if (stroke.mode === "erase") {
      this.ctx.globalCompositeOperation = "destination-out";
    } else {
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = stroke.color || "#222";
    }

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, (stroke.size || 3) / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = stroke.mode === "erase" ? "#000" : (stroke.color || "#222");
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  render() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    this.ctx.restore();

    for (const stroke of this.page.strokes || []) {
      this.drawStroke(stroke);
    }
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(structuredClone(this.page.strokes));
    this.page.strokes = this.undoStack.pop();
    this.render();
    this.onChange?.();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(structuredClone(this.page.strokes));
    this.page.strokes = this.redoStack.pop();
    this.render();
    this.onChange?.();
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}
