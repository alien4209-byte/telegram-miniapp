import React, { createContext, useContext, ReactNode } from 'react';
import { getTranslation } from '@/utils/i18n';

interface LanguageContextType {
	languageCode: string;
	t: (key: string, options?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ languageCode: string; children: ReactNode }> = ({
	languageCode,
	children,
}) => {
	const t = (key: string, options?: Record<string, any>): string => {
		let translation = getTranslation(languageCode, key);

		if (options) {
			Object.entries(options).forEach(([varKey, varValue]) => {
				if (typeof varValue === 'number' && translation.includes(`{{${varKey}, plural,`)) {
					const pluralForms = translation.match(new RegExp(`{{${varKey}, plural,([^}]+)}}`));
					if (pluralForms) {
						const forms = pluralForms[1].split('|').map(form => form.trim());
						let selectedForm = forms[forms.length - 1]; // default to last form (usually 'other')
						if (varValue === 1 && forms[0].startsWith('one:')) {
							selectedForm = forms[0].slice(4).trim();
						} else if (varValue > 1 && varValue < 5 && forms[1]?.startsWith('few:')) {
							selectedForm = forms[1].slice(4).trim();
						} else if (varValue >= 5 && forms[2]?.startsWith('many:')) {
							selectedForm = forms[2].slice(5).trim();
						}
						translation = translation.replace(pluralForms[0], selectedForm);
					}
				}
				translation = translation.replace(`{{${varKey}}}`, String(varValue));
			});
		}

		return translation;
	};

	return (
		<LanguageContext.Provider value={{ languageCode, t }}>{children}</LanguageContext.Provider>
	);
};

export const useLanguage = () => {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error('useLanguage must be used within a LanguageProvider');
	}
	return context;
};
