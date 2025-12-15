import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appAlphaNumeric]',
  standalone: true
})
export class AlphaNumericDirective {
  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event']) onInputChange(event: Event) {
    const initialValue = this.el.nativeElement.value;
    
    // SOLO letras básicas (sin tildes), números y guiones
    this.el.nativeElement.value = initialValue.replace(/[^A-Za-z0-9\-]/g, '');
    
    if (initialValue !== this.el.nativeElement.value) {
      event.stopPropagation();
    }
  }
}