import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appNumbersOnly]',
  standalone: true
})
export class NumbersOnlyDirective {
  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event']) onInputChange(event: Event) {
    const initialValue = this.el.nativeElement.value;
    
    // Remover cualquier caracter que no sea número
    this.el.nativeElement.value = initialValue.replace(/[^0-9]*/g, '');
    
    // Si el valor cambió, prevenir la entrada no válida
    if (initialValue !== this.el.nativeElement.value) {
      event.stopPropagation();
    }
  }

  @HostListener('keypress', ['$event']) onKeyPress(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    
    // Permitir solo teclas numéricas (0-9) y teclas de control
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }
}