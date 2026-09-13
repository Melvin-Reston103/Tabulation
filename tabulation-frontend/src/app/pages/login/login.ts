import { Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormField],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly credentialsModel = signal({ username: '', password: '' });
  protected readonly credentialsForm = form(this.credentialsModel, (schemaPath) => {
    required(schemaPath.username, { message: 'Username is required' });
    required(schemaPath.password, { message: 'Password is required' });
  });

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  onSubmit(event: Event): void {
    event.preventDefault();

    submit(this.credentialsForm, async () => {
      this.isSubmitting.set(true);
      this.errorMessage.set('');

      const { username, password } = this.credentialsModel();
      try {
        const response = await firstValueFrom(this.auth.login(username, password));
        await this.router.navigateByUrl(this.auth.homeRouteForRole(response.role));
      } catch {
        this.errorMessage.set('Invalid username or password.');
      } finally {
        this.isSubmitting.set(false);
      }
    });
  }
}