import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appAlphaNumeric]',
  standalone: true
})
export class AlphaNumericDirective {
  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event']) onInputChange(event: Event) {
    const initialValue = this.el.nativeElement.value;
    
    // Permitir letras, números, espacios y caracteres básicos
    this.el.nativeElement.value = initialValue.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]/g, '');
    
    if (initialValue !== this.el.nativeElement.value) {
      event.stopPropagation();
    }
  }
}