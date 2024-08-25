import React, { useMemo, useEffect } from 'react';
import { useLaunchParams, useCloudStorage } from '@telegram-apps/sdk-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useErrorBoundary } from 'react-error-boundary';
import { initMiniApp } from '@/services/api';
import Calendar from '@/layouts/Calendar/Calendar';
import Home from '@/layouts/Home/Home';
import Onboarding from '@/layouts/Onboarding/Onboarding';
import { cacheWithCloudStorage } from '@/utils/cacheWithCloudStorage';
import { useLanguage } from '@/utils/LanguageContext';
import { getSupportedLanguageCode } from '@/utils/i18n';
import { TelegramInitData, InitMiniAppResponse } from '@/types/Types';
import { useGlobalContext } from '@/context/GlobalContext';
import Loading from '@/utils/Loading';

const INIT_QUERY_KEY = 'initData';
const ONBOARDING_STATUS_KEY = 'hasCompletedOnboarding';
const ERROR_MESSAGES = {
	INIT_DATA_RAW_UNAVAILABLE: 'error.initDataRawUnavailable',
	TOKEN_MISSING: 'error.tokenMissing',
	UNKNOWN: 'error.unknown',
} as const;

const InitializerPage: React.FC = () => {
	const { initDataRaw } = useLaunchParams();
	const cloudStorage = useCloudStorage();
	const { token, setToken, setLanguage } = useGlobalContext();
	const { t, languageCode } = useLanguage();
	const cache = useMemo(() => cacheWithCloudStorage(cloudStorage), [cloudStorage]);
	const { showBoundary } = useErrorBoundary();

	const {
		isPending: isInitLoading,
		isError: isInitError,
		error: initError,
		data: initData,
	} = useQuery<InitMiniAppResponse, Error, InitMiniAppResponse, [string, TelegramInitData]>({
		queryKey: [INIT_QUERY_KEY, { init_data_raw: initDataRaw || '' }],
		queryFn: ({ queryKey }) => initMiniApp(queryKey[1]),
		enabled: !!initDataRaw,
		retry: false,
		staleTime: Infinity,
	});

	const {
		data: isOnboardingComplete,
		isLoading: isStatusLoading,
		isError: isStatusError,
		error: statusError,
		refetch: refetchOnboarding,
	} = useQuery<boolean, Error>({
		queryKey: ['onboardingStatus'],
		queryFn: async () => {
			const status = await cache.get<boolean>(ONBOARDING_STATUS_KEY);
			return status ?? false;
		},
		retry: 1,
		enabled: !!initData, // Only run this query after initData is available
	});

	const setOnboardingComplete = useMutation({
		mutationFn: async (completed: boolean) => {
			await cache.set(ONBOARDING_STATUS_KEY, completed);
		},
		onSuccess: () => refetchOnboarding(),
	});

	useEffect(() => {
		if (initData) {
			setToken(initData.token);
			const newLanguageCode = getSupportedLanguageCode(initData.user.language_code);
			if (newLanguageCode !== languageCode) {
				setLanguage(newLanguageCode);
			}
		}
	}, [initData, setToken, setLanguage, languageCode]);

	useEffect(() => {
		if (isInitError || isStatusError) {
			const error = isInitError ? initError : statusError;
			const errorMessage = error?.message || ERROR_MESSAGES.UNKNOWN;
			showBoundary(new Error(t(errorMessage)));
		}
	}, [isInitError, isStatusError, initError, statusError, showBoundary, t]);

	// Don't render anything until we have a valid response and all data
	if (
		isInitLoading ||
		isStatusLoading ||
		!initData ||
		!token ||
		isOnboardingComplete === undefined
	) {
		return <Loading />;
	}

	// Render main content only when we have all necessary data
	return (
		<>
			{initData.start_page === 'calendar' && initData.start_param ? (
				<Calendar apiRef={initData.start_param} />
			) : isOnboardingComplete ? (
				<Home />
			) : (
				<Onboarding onComplete={() => setOnboardingComplete.mutate(true)} />
			)}
		</>
	);
};

export default InitializerPage;
