import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appLettersOnly]',
  standalone: true
})
export class LettersOnlyDirective {
  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event']) onInputChange(event: Event) {
    const initialValue = this.el.nativeElement.value;
    
    // Remover cualquier caracter que no sea letra, espacio, acentos o ñ
    this.el.nativeElement.value = initialValue.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
    
    // Si el valor cambió, prevenir la entrada no válida
    if (initialValue !== this.el.nativeElement.value) {
      event.stopPropagation();
    }
  }

  @HostListener('keypress', ['$event']) onKeyPress(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    const charStr = String.fromCharCode(charCode);
    
    // Permitir solo letras, espacios y caracteres especiales en español
    const allowedChars = /[A-Za-zÁÉÍÓÚáéíóúÑñ\s]/;
    
    if (!allowedChars.test(charStr)) {
      event.preventDefault();
      return false;
    }
    return true;
  }
}