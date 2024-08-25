import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { useMainButton, useBackButton, useMiniApp } from '@telegram-apps/sdk-react';
import { Tabbar, Spinner } from '@telegram-apps/telegram-ui';
import { useLanguage } from '@/utils/LanguageContext';
import styles from '@/layouts/Home/Home.module.css';

const DateSelection = lazy(() => import('@/layouts/DateSelection/DateSelection'));
const Invite = lazy(() => import('@/layouts/Invite/Invite'));
const Search = lazy(() => import('@/layouts/Search/Search'));

const Home: React.FC = () => {
	const { t } = useLanguage();
	const mainButton = useMainButton();
	const backButton = useBackButton();
	const miniApp = useMiniApp();

	const tabConfig = useMemo(
		() => [
			{ id: 'calendar', icon: '📅', component: DateSelection, label: t('home.tabs.calendar') },
			{ id: 'invite', icon: '🗓️', component: Invite, label: t('home.tabs.invite') },
			{ id: 'settings', icon: '⚙️', component: Search, label: t('home.tabs.settings') },
		],
		[t]
	);

	const [currentTabId, setCurrentTabId] = useState(tabConfig[0].id);
	const [tabHistory, setTabHistory] = useState<string[]>([tabConfig[0].id]);

	const currentTab = useMemo(
		() => tabConfig.find(tab => tab.id === currentTabId) || tabConfig[0],
		[currentTabId, tabConfig]
	);

	useEffect(() => {
		miniApp.ready();
		backButton.show();
		return () => {
			backButton.hide();
		};
	}, [miniApp, backButton]);

	const handleTabChange = useCallback(
		(tabId: string) => {
			if (tabId !== currentTabId) {
				setCurrentTabId(tabId);
				setTabHistory(prev => [...prev, tabId]);
				mainButton.hide();
			}
		},
		[currentTabId, mainButton]
	);

	const handleBackButton = useCallback(() => {
		if (tabHistory.length > 1) {
			const newHistory = tabHistory.slice(0, -1);
			setTabHistory(newHistory);
			setCurrentTabId(newHistory[newHistory.length - 1]);
		} else {
			miniApp.close();
		}
	}, [tabHistory, miniApp]);

	useEffect(() => {
		backButton.on('click', handleBackButton);
		return () => {
			backButton.off('click', handleBackButton);
		};
	}, [backButton, handleBackButton]);

	const ActiveComponent = currentTab.component;

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<Suspense
					fallback={
						<div className={styles.spinner}>
							<Spinner size="l" />
						</div>
					}
				>
					<ActiveComponent />
				</Suspense>
			</div>
			<Tabbar className={styles.tabbar}>
				{tabConfig.map(({ id, icon, label }) => (
					<Tabbar.Item
						key={id}
						selected={id === currentTabId}
						onClick={() => handleTabChange(id)}
						text={label}
					>
						<span className={styles.tabIcon}>{icon}</span>
					</Tabbar.Item>
				))}
			</Tabbar>
		</div>
	);
};

export default React.memo(Home);
