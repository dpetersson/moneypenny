import { createHash, randomBytes, createCipheriv, createDecipheriv, CipherGCM, DecipherGCM } from 'crypto';

// Use a device-specific key based on vault path
// This provides basic protection against copying data.json between vaults
export class CryptoHelper {
    private static algorithm = 'aes-256-gcm';
    
    // Generate a key based on the vault path
    private static getKey(vaultPath: string): Buffer {
        // Create a deterministic key based on vault path
        // This means the same vault will always generate the same key
        const hash = createHash('sha256');
        hash.update(vaultPath);
        hash.update('moneypenny-secret-2024'); // Add app-specific salt
        return hash.digest();
    }
    
    static encrypt(text: string, vaultPath: string): string {
        if (!text) return '';
        
        try {
            const key = this.getKey(vaultPath);
            const iv = randomBytes(16);
            const cipher = createCipheriv(this.algorithm, key, iv) as CipherGCM;
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            // Combine iv, authTag, and encrypted data
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            // Fallback to plain text if encryption fails
            return text;
        }
    }
    
    static decrypt(encryptedText: string, vaultPath: string): string {
        if (!encryptedText) return '';
        
        // Check if it's already plain text (for backward compatibility)
        if (!encryptedText.includes(':')) {
            return encryptedText;
        }
        
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 3) {
                // Not encrypted, return as-is
                return encryptedText;
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const key = this.getKey(vaultPath);
            const decipher = createDecipheriv(this.algorithm, key, iv) as DecipherGCM;
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            // Return the original text if decryption fails
            // This handles backward compatibility
            return encryptedText;
        }
    }
    
    static isEncrypted(text: string): boolean {
        if (!text) return false;
        // Check if text has our encryption format (iv:authTag:encrypted)
        const parts = text.split(':');
        return parts.length === 3 && 
               parts[0].length === 32 && // IV is 16 bytes = 32 hex chars
               parts[1].length === 32;   // Auth tag is 16 bytes = 32 hex chars
    }
}