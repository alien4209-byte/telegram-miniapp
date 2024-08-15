export async function sha256(message: string): Promise<string> {
	if (typeof message !== 'string') {
		throw new TypeError('Input must be a string');
	}
	try {
		const msgUint8 = new TextEncoder().encode(message);
		const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
		return hex(new Uint8Array(hashBuffer));
	} catch (error) {
		throw new Error('Hashing operation failed');
	}
}

export const hmacSha256 = async (
	body: string,
	secret: string | Uint8Array
): Promise<Uint8Array> => {
	const enc = new TextEncoder();
	const algorithm = { name: 'HMAC', hash: 'SHA-256' };
	if (!(secret instanceof Uint8Array)) {
		secret = enc.encode(secret);
	}
	const key = await crypto.subtle.importKey('raw', secret, algorithm, false, ['sign', 'verify']);

	const signature = await crypto.subtle.sign(algorithm.name, key, enc.encode(body));

	return new Uint8Array(signature);
};

export const hex = (buffer: Uint8Array): string => {
	const hashArray = Array.from(buffer);
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateSecret = (bytes: number): string => {
	// Ensure at least 16 bytes (128 bits) of entropy
	const minBytes = Math.max(bytes, 16);
	const buffer = new Uint8Array(minBytes);
	crypto.getRandomValues(buffer);
	return hex(buffer);
};

export async function compareHash(storedHash: string, inputSecret: string): Promise<boolean> {
	const inputHash = await sha256(inputSecret);

	if (storedHash.length !== inputHash.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < storedHash.length; i++) {
		result |= storedHash.charCodeAt(i) ^ inputHash.charCodeAt(i);
	}

	return result === 0;
}

export const generateReference = (length: number = 8): string => {
	// Use 6 bits per character to ensure URL-friendly base64
	const bytes = Math.ceil((length * 6) / 8);
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);

	// Convert Uint8Array to a regular array
	const byteArray = Array.from(buffer);

	// Convert to base64 and remove non-URL-friendly characters
	return btoa(String.fromCharCode.apply(null, byteArray))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')
		.slice(0, length);
};
