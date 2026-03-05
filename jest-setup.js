// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// Override canvas getContext to provide measureText for Grafana UI Select
HTMLCanvasElement.prototype.getContext = () => ({
  measureText: () => ({ width: 0 }),
  fillText: () => {},
  clearRect: () => {},
  font: '',
});
