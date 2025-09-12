export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;
  private static readonly REQUIRE_UPPERCASE = true;
  private static readonly REQUIRE_LOWERCASE = true;
  private static readonly REQUIRE_NUMBERS = true;
  private static readonly REQUIRE_SPECIAL_CHARS = true;
  private static readonly SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    // Check maximum length
    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must be no more than ${this.MAX_LENGTH} characters long`);
    }

    // Check for uppercase letters
    if (this.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (this.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (this.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special characters
    if (this.REQUIRE_SPECIAL_CHARS && !new RegExp(`[${this.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
      errors.push(`Password must contain at least one special character (${this.SPECIAL_CHARS})`);
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'dragon',
      'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password cannot contain more than 2 consecutive identical characters');
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password)) {
      errors.push('Password cannot contain sequential characters (e.g., abc, 123)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static hasSequentialChars(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    
    // Check for sequential letters
    for (let i = 0; i < lowerPassword.length - 2; i++) {
      const char1 = lowerPassword.charCodeAt(i);
      const char2 = lowerPassword.charCodeAt(i + 1);
      const char3 = lowerPassword.charCodeAt(i + 2);
      
      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }
    }

    // Check for sequential numbers
    for (let i = 0; i < password.length - 2; i++) {
      const char1 = password.charCodeAt(i);
      const char2 = password.charCodeAt(i + 1);
      const char3 = password.charCodeAt(i + 2);
      
      if (char1 >= 48 && char1 <= 57 && // is digit
          char2 >= 48 && char2 <= 57 && // is digit
          char3 >= 48 && char3 <= 57 && // is digit
          char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }
    }

    return false;
  }

  static getPasswordRequirements(): string[] {
    return [
      `At least ${this.MIN_LENGTH} characters long`,
      'At least one uppercase letter',
      'At least one lowercase letter',
      'At least one number',
      `At least one special character (${this.SPECIAL_CHARS})`,
      'No more than 2 consecutive identical characters',
      'No sequential characters (e.g., abc, 123)',
      'Not a common password'
    ];
  }
}
