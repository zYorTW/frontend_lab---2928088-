import { Injectable, signal } from '@angular/core';

export type SnackType = 'success' | 'error' | 'warn' | 'info';

export interface SnackbarConfig {
  duration?: number;
  action?: string;
  onAction?: () => void;
}

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  readonly openSig = signal(false);
  readonly messageSig = signal('');
  readonly typeSig = signal<SnackType>('info');
  readonly actionSig = signal<string | undefined>(undefined);
  private hideTimer: any;
  private actionCallback?: () => void;

  private show(msg: string, type: SnackType, config: SnackbarConfig = {}) {
    try { clearTimeout(this.hideTimer); } catch {}
    
    this.messageSig.set(msg);
    this.typeSig.set(type);
    this.actionSig.set(config.action);
    this.actionCallback = config.onAction;
    this.openSig.set(true);
    
    const duration = config.duration || this.getDefaultDuration(type);
    this.hideTimer = setTimeout(() => this.openSig.set(false), Math.max(1200, duration));
  }

  private getDefaultDuration(type: SnackType): number {
    switch(type) {
      case 'error': return 5000;
      case 'warn': return 4000;
      case 'success': return 3000;
      case 'info': return 3000;
      default: return 3000;
    }
  }

  success(msg: string, config: SnackbarConfig = {}) { 
    this.show(msg, 'success', config); 
  }
  
  error(msg: string, config: SnackbarConfig = {}) { 
    this.show(msg, 'error', config); 
  }
  
  warn(msg: string, config: SnackbarConfig = {}) { 
    this.show(msg, 'warn', config); 
  }
  
  info(msg: string, config: SnackbarConfig = {}) { 
    this.show(msg, 'info', config); 
  }
  
  close() { 
    this.openSig.set(false); 
  }

  onAction() {
    if (this.actionCallback) {
      this.actionCallback();
    }
    this.close();
  }
}