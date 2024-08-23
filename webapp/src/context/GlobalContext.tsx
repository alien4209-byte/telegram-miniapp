import React, { createContext, useState, useContext, ReactNode } from 'react';

interface GlobalState {
	token: string | null;
	language: string;
}

interface GlobalContextType extends GlobalState {
	setToken: (token: string | null) => void;
	setLanguage: (language: string) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

interface GlobalProviderProps {
	children: ReactNode;
	initialLanguage: string;
	setLanguage: (language: string) => void;
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({
	children,
	initialLanguage,
	setLanguage: setAppLanguage,
}) => {
	const [token, setToken] = useState<string | null>(null);
	const [language, setLanguageState] = useState<string>(initialLanguage);

	const setLanguage = (newLanguage: string) => {
		setLanguageState(newLanguage);
		setAppLanguage(newLanguage);
	};

	return (
		<GlobalContext.Provider value={{ token, setToken, language, setLanguage }}>
			{children}
		</GlobalContext.Provider>
	);
};

export const useGlobalContext = () => {
	const context = useContext(GlobalContext);
	if (context === undefined) {
		throw new Error('useGlobalContext must be used within a GlobalProvider');
	}
	return context;
};
