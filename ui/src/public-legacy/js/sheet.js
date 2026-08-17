export class LateralSheet {
  static backdrop = null;
  static drawer = null;
  static titleEl = null;
  static bodyEl = null;
  static footerEl = null;

  static init() {
    this.backdrop = document.getElementById("sheet-backdrop");
    this.drawer = document.getElementById("sheet-drawer");
    this.titleEl = document.getElementById("sheet-title");
    this.bodyEl = document.getElementById("sheet-body");
    this.footerEl = document.getElementById("sheet-footer");

    document.getElementById("btn-close-sheet")?.addEventListener("click", () => this.close());
    this.backdrop?.addEventListener("click", () => this.close());
  }

  static open({ title, contentHtml, footerHtml }) {
    if (!this.drawer || !this.backdrop) return;
    if (this.titleEl) this.titleEl.innerText = title;
    if (this.bodyEl) this.bodyEl.innerHTML = contentHtml;
    if (this.footerEl) {
      if (footerHtml) {
        this.footerEl.innerHTML = footerHtml;
        this.footerEl.classList.remove("hidden");
      } else {
        this.footerEl.classList.add("hidden");
      }
    }
    this.backdrop.classList.add("open");
    this.drawer.classList.add("open");
  }

  static close() {
    if (!this.drawer || !this.backdrop) return;
    this.backdrop.classList.remove("open");
    this.drawer.classList.remove("open");
  }
}
