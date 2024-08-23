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

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [token, setToken] = useState<string | null>(null);
	const [language, setLanguage] = useState<string>('en'); // Default to 'en'

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
