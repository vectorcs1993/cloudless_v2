export class TraceManager {
  constructor(interactionManager, scheduleRender) {
    this.interactionManager = interactionManager;
    this.scheduleRender = scheduleRender;
    this.isActive = false;
  }

  cancelTrace() {
    this.isActive = false;
    this.interactionManager?.cancelTrace();
    this.scheduleRender();
  }

  onTraceStart() {
    this.isActive = true;
  }

  setActive(active) {
    this.isActive = active;
  }
}
