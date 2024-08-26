import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
	bindMiniAppCSSVars,
	bindThemeParamsCSSVars,
	bindViewportCSSVars,
	useLaunchParams,
	useMiniApp,
	useThemeParams,
	useViewport,
	useClosingBehavior,
	useBackButton,
	useSwipeBehavior,
} from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/utils/LanguageContext';
import InitializerPage from '@/layouts/InitializerPage/InitializerPage';
import ErrorFallback from '@/utils/ErrorFallback';
//import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import '@telegram-apps/telegram-ui/dist/styles.css';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
		},
	},
});

export const App: React.FC = () => {
	const [language, setLanguage] = useState('en'); // Default language
	const lp = useLaunchParams();
	const miniApp = useMiniApp();
	const themeParams = useThemeParams();
	const viewport = useViewport();
	const closingBehavior = useClosingBehavior();
	const backButton = useBackButton();
	const swipeBehavior = useSwipeBehavior();

	useEffect(() => {
		if (viewport) {
			bindViewportCSSVars(viewport);
			viewport.expand();
			swipeBehavior.disableVerticalSwipe();
		}
	}, [viewport, swipeBehavior]);

	useEffect(() => {
		bindMiniAppCSSVars(miniApp, themeParams);
	}, [miniApp, themeParams]);

	useEffect(() => {
		bindThemeParamsCSSVars(themeParams);
	}, [themeParams]);

	useEffect(() => {
		closingBehavior.enableConfirmation();
		return () => closingBehavior.disableConfirmation();
	}, [closingBehavior]);

	useEffect(() => {
		backButton.show();
		return () => {
			backButton.hide();
		};
	}, [backButton]);

	return (
		<AppRoot
			appearance={miniApp.isDark ? 'dark' : 'light'}
			platform={['macos', 'ios'].includes(lp.platform) ? 'ios' : 'base'}
		>
			<QueryClientProvider client={queryClient}>
				<GlobalProvider initialLanguage={language} setLanguage={setLanguage}>
					<LanguageProvider languageCode={language}>
						<ErrorBoundary FallbackComponent={ErrorFallback}>
							<InitializerPage />
						</ErrorBoundary>
					</LanguageProvider>
				</GlobalProvider>
				{/* <ReactQueryDevtools initialIsOpen={false} /> */}
			</QueryClientProvider>
		</AppRoot>
	);
};

export default App;
