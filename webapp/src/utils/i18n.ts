import en from '../lang/en.json';
import ru from '../lang/ru.json';
import uk from '../lang/uk.json';
import es from '../lang/es.json';
import ptBR from '../lang/pt-BR.json';

const translations: { [key: string]: any } = { en, ru, uk, es, 'pt-BR': ptBR };

export const getTranslation = (
	languageCode: string,
	key: string,
	fallback: string = ''
): string => {
	const keys = key.split('.');
	let result = translations[languageCode] || translations['en'];

	for (const k of keys) {
		if (result[k] === undefined) {
			console.warn(`Translation key "${key}" not found for language "${languageCode}"`);
			return fallback || key;
		}
		result = result[k];
	}

	return result;
};

export const getSupportedLanguageCode = (code: string | null): string => {
	const supportedCodes = Object.keys(translations);
	return code && supportedCodes.includes(code) ? code : 'en';
};
