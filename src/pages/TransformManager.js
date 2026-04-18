// TransformManager.js

export class TransformManager {
  constructor(interactionManager, scheduleRender) {
    this.interactionManager = interactionManager;
    this.scheduleRender = scheduleRender;
    this.isActive = false;
    this.transformStartPort = null;
    this.transformStartElement = null;
    this.transformStartPoint = null;
    this.fixedPort = null;
    this.movingPort = null;
    this.originalParameters = null;
    this.transformGhostPoints = [];
  }

  startTransform(port, element) {

    if (!port || !element) return false;

    // Только для прямого воздуховода
    if (element.type !== 'duct') {
      return false;
    }

    // ========== НОВАЯ ПРОВЕРКА: запрещаем трансформацию если порт имеет подключения ==========
    if (port.isConnected && port.isConnected()) {
      this.interactionManager?.onError?.('Нельзя трансформировать воздуховод, у которого есть подключения. Сначала отключите связи.');
      return false;
    }

    this.isActive = true;
    this.transformStartElement = element;
    this.movingPort = port;

    // Находим противоположный порт (статический)
    const ports = element.ports || [];

    if (port.direction === 'inlet' || port.direction === 'left') {
      this.fixedPort = ports.find(p => p.direction === 'outlet' || p.direction === 'right');
    } else {
      this.fixedPort = ports.find(p => p.direction === 'inlet' || p.direction === 'left');
    }

    if (!this.fixedPort) {
      return false;
    }


    // Сохраняем стартовую точку
    this.transformStartPoint = { x: port.worldX, y: port.worldY };

    // Сохраняем оригинальные параметры
    this.originalParameters = {
      b: element.b,
      x: element.x,
      y: element.y,
      rotation: element.rotation
    };

    // Устанавливаем точки для отрисовки
    this.transformGhostPoints = [this.fixedPort, { x: port.worldX, y: port.worldY }];

    this.interactionManager?.setTransformActive(true, port, element);
    return true;
  }

  updateTransform(worldPos, gridStepM, mmPerPx, snapLengthMm, snapAngleDeg) {
    if (!this.isActive || !this.transformStartElement) {
      return false;
    }

    const element = this.transformStartElement;
    if (!this.fixedPort) return false;

    const fixedPoint = { x: this.fixedPort.worldX, y: this.fixedPort.worldY };
    const currentPoint = { x: worldPos.x, y: worldPos.y };

    // Вычисляем расстояние
    let dx = currentPoint.x - fixedPoint.x;
    let dy = currentPoint.y - fixedPoint.y;
    let distancePx = Math.hypot(dx, dy);

    // Привязка длины к шагу (в миллиметрах)
    let distanceMm = distancePx * mmPerPx;
    const snappedDistanceMm = Math.round(distanceMm / snapLengthMm) * snapLengthMm;
    const finalDistanceMm = Math.max(30, snappedDistanceMm);
    const finalDistancePx = finalDistanceMm / mmPerPx;

    // Вычисляем угол
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    // Привязка углов с заданным шагом
    const snapAngles = [];
    for (let a = 0; a < 360; a += snapAngleDeg) {
      snapAngles.push(a);
    }

    let minDiff = 180;
    let snappedAngle = angle;

    for (const sa of snapAngles) {
      let diff = Math.abs(angle - sa);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        snappedAngle = sa;
      }
    }

    const finalAngle = minDiff <= (snapAngleDeg / 2) ? snappedAngle : angle;

    // Вычисляем новую позицию порта
    const rad = finalAngle * Math.PI / 180;
    const newPortPosition = {
      x: fixedPoint.x + Math.cos(rad) * finalDistancePx,
      y: fixedPoint.y + Math.sin(rad) * finalDistancePx
    };

    // Обновляем точки для отрисовки
    this.transformGhostPoints = [fixedPoint, newPortPosition];

    // Применяем трансформацию
    element.x = (fixedPoint.x + newPortPosition.x) / 2;
    element.y = (fixedPoint.y + newPortPosition.y) / 2;
    element.b = finalDistanceMm;
    element.rotation = finalAngle;

    // Обновляем порты и выноску
    element.updatePorts();
    element.updateCalloutText();

    return true;
  }

  endTransform(updateConnectionsCallback) {

    if (!this.isActive) return false;

    this.isActive = false;
    this.transformStartPort = null;
    this.transformStartElement = null;
    this.transformStartPoint = null;
    this.fixedPort = null;
    this.movingPort = null;
    this.transformGhostPoints = [];
    this.originalParameters = null;

    this.interactionManager?.setTransformActive(false);

    if (updateConnectionsCallback) {
      setTimeout(() => updateConnectionsCallback(), 50);
    }

    this.scheduleRender?.();
    return true;
  }

  cancelTransform() {

    if (!this.isActive || !this.transformStartElement || !this.originalParameters) return false;

    const element = this.transformStartElement;
    const orig = this.originalParameters;

    element.b = orig.b;
    element.x = orig.x;
    element.y = orig.y;
    element.rotation = orig.rotation;

    element.updatePorts();
    element.updateCalloutText();

    this.endTransform();
    return true;
  }

  canTransformPort(port, element) {
    // Проверяем что это воздуховод
    if (!port || !element || element.type !== 'duct') {
      return false;
    }

    // ========== НОВАЯ ПРОВЕРКА: запрещаем трансформацию если порт имеет подключения ==========
    if (port.isConnected && port.isConnected()) {
      return false;
    }

    return true;
  }

  isTransforming() {
    return this.isActive;
  }

  getGhostPoints() {
    return this.transformGhostPoints;
  }
}
