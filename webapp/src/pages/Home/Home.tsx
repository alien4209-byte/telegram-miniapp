import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { Tabbar } from '@telegram-apps/telegram-ui';
import { useMainButton, useBackButton, useMiniApp } from '@telegram-apps/sdk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '@/pages/Home/Home.module.css';

const DateSelection = lazy(() => import('@/pages/DateSelection/DateSelection'));
const Invite = lazy(() => import('@/pages/Invite/Invite'));
const Search = lazy(() => import('@/pages/Search/Search'));

const tabConfig = [
	{ id: 'calendar', icon: '📅', path: '/home/calendar', component: DateSelection },
	{ id: 'invite', icon: '🗓️', path: '/home/invite', component: Invite },
	{ id: 'settings', icon: '⚙️', path: '/home/settings', component: Search },
];

const Home: React.FC<{ token: string }> = ({ token }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const mainButton = useMainButton();
	const backButton = useBackButton();
	const miniApp = useMiniApp();

	const [tabHistory, setTabHistory] = useState<string[]>([tabConfig[0].id]);

	const currentTab = useMemo(() => {
		const currentPath = location.pathname;
		return tabConfig.find(tab => currentPath.includes(tab.id)) || tabConfig[0];
	}, [location.pathname]);

	useEffect(() => {
		miniApp.ready();
		backButton.show();

		// Set initial route if not already on a tab route
		if (!location.pathname.includes('/home/')) {
			navigate(tabConfig[0].path, { replace: true });
		}

		return () => {
			backButton.hide();
		};
	}, [miniApp, backButton, navigate, location.pathname]);

	const handleTabChange = useCallback(
		(tabId: string) => {
			const newTab = tabConfig.find(tab => tab.id === tabId);
			if (newTab && newTab.id !== currentTab.id) {
				setTabHistory(prev => [...prev, newTab.id]);
				navigate(newTab.path);
				mainButton.hide();
			}
		},
		[currentTab.id, navigate, mainButton]
	);

	const handleBackButton = useCallback(() => {
		if (tabHistory.length > 1) {
			const newHistory = tabHistory.slice(0, -1);
			const previousTab = tabConfig.find(tab => tab.id === newHistory[newHistory.length - 1]);
			if (previousTab) {
				setTabHistory(newHistory);
				navigate(previousTab.path);
			}
		} else {
			miniApp.close();
		}
	}, [tabHistory, navigate, miniApp]);

	useEffect(() => {
		backButton.on('click', handleBackButton);
		return () => {
			backButton.off('click', handleBackButton);
		};
	}, [backButton, handleBackButton]);

	const ActiveComponent = currentTab.component;

	return (
		<div className={styles.container}>
			<Suspense fallback={<div>Loading...</div>}>
				<ActiveComponent token={token} />
			</Suspense>

			<Tabbar className={styles.tabbar}>
				{tabConfig.map(({ id, icon }) => (
					<Tabbar.Item
						key={id}
						text={id.charAt(0).toUpperCase() + id.slice(1)}
						selected={id === currentTab.id}
						onClick={() => handleTabChange(id)}
					>
						<div style={{ width: 28, height: 28 }}>{icon}</div>
					</Tabbar.Item>
				))}
			</Tabbar>
		</div>
	);
};

export default React.memo(Home);
