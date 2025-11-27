import { Component, OnInit, OnDestroy, AfterViewInit, Renderer2, Inject } from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { authService } from '../../services/auth/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {
  email = '';
  contrasena = '';
  error = '';
  loading = false;
  triedSubmit = false;
  private returnUrl = '/dashboard';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    public snack: SnackbarService,
  ) {
    const q = this.route.snapshot.queryParamMap.get('returnUrl');
    // Aceptar sólo rutas internas seguras empezando por '/dashboard'
    if (q && /^\/dashboard(\/|$)/.test(q)) {
      this.returnUrl = q;
    } else {
      this.returnUrl = '/dashboard';
    }
  }

  ngOnInit(): void {
    console.debug('[login] ngOnInit: adding body.auth-page');
    this.renderer.addClass(this.document.body, 'auth-page');
  }

  ngAfterViewInit(): void {
    // Crear partículas después de que la vista se haya renderizado
    this.createParticles();
  }

  ngOnDestroy(): void {
    console.debug('[login] ngOnDestroy: removing body.auth-page');
    this.renderer.removeClass(this.document.body, 'auth-page');
  }

  createParticles(): void {
    const particlesContainer = this.document.getElementById('particles');
    if (!particlesContainer) return;

    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.renderer.createElement('div');
      this.renderer.addClass(particle, 'particle');
      this.renderer.setStyle(particle, 'left', Math.random() * 100 + '%');
      this.renderer.setStyle(particle, 'top', Math.random() * 100 + '%');
      this.renderer.setStyle(particle, 'animation-delay', Math.random() * 6 + 's');
      this.renderer.setStyle(particle, 'animation-duration', (Math.random() * 3 + 4) + 's');
      this.renderer.appendChild(particlesContainer, particle);
    }
  }

  async onSubmit(e: Event, form?: NgForm) {
  e?.preventDefault();
  this.triedSubmit = true;
  this.error = '';
  
  // ✅ VALIDACIONES FRONTEND MÁS ESPECÍFICAS
  if (form && form.invalid) {
    Object.values(form.controls).forEach((c: any) => c?.control?.markAsTouched?.());
    
    if (!this.email) {
      this.snack.warn('📧 Ingresa tu correo electrónico');
    } else if (!this.contrasena) {
      this.snack.warn('🔒 Ingresa tu contraseña');
    } else {
      this.snack.warn('Completa los campos requeridos');
    }
    return;
  }
  
  // ✅ VALIDAR FORMATO EMAIL
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.email)) {
    this.snack.warn('📧 Formato de email inválido');
    return;
  }

  this.loading = true;
  try {
    await authService.login(this.email, this.contrasena);
    this.triedSubmit = false;
    this.snack.success('✅ Bienvenido');
    await this.router.navigateByUrl(this.returnUrl);
  } catch (err: any) {
    console.error('Error al iniciar sesión:', err);
    this.error = err?.message || 'Error al iniciar sesión. Intenta nuevamente.';
    this.snack.error(this.error);
  } finally {
    this.loading = false;
  }
}

  // Placeholder for Google sign-in flow (UI only)
  onGoogleSignIn() {
    // implement OAuth redirect or popup here
    console.log('Google sign-in clicked');
  }
}