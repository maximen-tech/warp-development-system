class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 60;
    this.buffer = options.buffer || 5;
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.renderFunction = options.renderFunction || ((item) => `<div>${JSON.stringify(item)}</div>`);
    
    this.viewport = document.createElement('div');
    this.viewport.style.cssText = 'overflow-y: auto; height: 100%; position: relative;';
    
    this.spacer = document.createElement('div');
    this.spacer.style.cssText = 'position: relative;';
    
    this.content = document.createElement('div');
    this.content.style.cssText = 'position: absolute; width: 100%; will-change: transform;';
    
    this.spacer.appendChild(this.content);
    this.viewport.appendChild(this.spacer);
    this.container.appendChild(this.viewport);
    
    this.viewport.addEventListener('scroll', () => this.handleScroll());
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  setItems(items) {
    this.items = items;
    this.spacer.style.height = `${this.items.length * this.itemHeight}px`;
    this.render();
  }

  handleScroll() {
    requestAnimationFrame(() => this.render());
  }

  handleResize() {
    this.render();
  }

  render() {
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    
    this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    this.visibleEnd = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer
    );

    const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
    
    this.content.style.transform = `translateY(${this.visibleStart * this.itemHeight}px)`;
    this.content.innerHTML = visibleItems.map(item => this.renderFunction(item)).join('');
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    this.container.removeChild(this.viewport);
  }

  scrollToIndex(index) {
    const scrollTop = index * this.itemHeight;
    this.viewport.scrollTop = scrollTop;
  }

  getVisibleRange() {
    return { start: this.visibleStart, end: this.visibleEnd };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroll;
}
