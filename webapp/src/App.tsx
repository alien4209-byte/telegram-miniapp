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
import React, { useEffect } from 'react';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/utils/LanguageContext';
import InitializerPage from '@/screens/InitializerPage/InitializerPage';

import '@telegram-apps/telegram-ui/dist/styles.css';

const queryClient = new QueryClient();

export const App: React.FC = () => {
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
				<GlobalProvider>
					<LanguageProvider languageCode="en">
						<InitializerPage />
					</LanguageProvider>
				</GlobalProvider>
			</QueryClientProvider>
		</AppRoot>
	);
};

export default App;
