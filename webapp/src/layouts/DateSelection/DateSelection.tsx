import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import {
	useMiniApp,
	useMainButton,
	initPopup,
	initHapticFeedback,
	useBackButton,
} from '@telegram-apps/sdk-react';
import { useMutation } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { sendDates } from '@/services/api';
import { useGlobalContext } from '@/context/GlobalContext';
import { useLanguage } from '@/utils/LanguageContext';
import Loading from '@/utils/Loading';

import 'react-day-picker/dist/style.css';
import styles from '@/layouts/DateSelection/DateSelection.module.css';

// Import all locales you need
import { es, ru, ptBR, uk } from 'date-fns/locale';

const locales: { [key: string]: Locale } = { es, ru, uk, ptBR };

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

const DateSelection: React.FC = () => {
	const { t, languageCode } = useLanguage();
	const { token } = useGlobalContext();
	const miniapp = useMiniApp();
	const mainButton = useMainButton();
	const backButton = useBackButton();
	const popup = initPopup();
	const hapticFeedback = initHapticFeedback();
	const [selectedDates, setSelectedDates] = useState<Date[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const dateMutation = useMutation({
		mutationKey: ['sendDate', token],
		mutationFn: (dates: Date[]) => sendDates(token, dates.map(formatDate)),
		onSuccess: () => miniapp.close(true),
		onError: error => {
			setIsSubmitting(false);
			popup
				.open({
					title: t('dateSelection.errorTitle'),
					message: t('dateSelection.errorMessage', {
						error: error instanceof Error ? error.message : t('dateSelection.unknownError'),
					}),
					buttons: [
						{ id: 'ok', type: 'default', text: t('common.ok') },
						{ id: 'retry', type: 'default', text: t('common.retry') },
					],
				})
				.then((buttonId: string | null) => {
					if (buttonId === 'retry') handleMainButtonClick();
				});
		},
	});

	const handleMainButtonClick = useCallback(() => {
		if (selectedDates.length > 0 && !isSubmitting) {
			hapticFeedback.impactOccurred('medium');
			setIsSubmitting(true);
			dateMutation.mutate(selectedDates);
		}
	}, [selectedDates, dateMutation, hapticFeedback, isSubmitting]);

	useEffect(() => {
		miniapp.ready();

		if (selectedDates.length > 0) {
			mainButton.setText(t('dateSelection.selectDates')).show();
			mainButton[isSubmitting ? 'showLoader' : 'hideLoader']();
			mainButton[isSubmitting ? 'disable' : 'enable']();
			mainButton.on('click', handleMainButtonClick);
		} else {
			mainButton.hide();
		}

		return () => {
			mainButton.off('click', handleMainButtonClick);
		};
	}, [miniapp, selectedDates, isSubmitting, mainButton, handleMainButtonClick, t]);

	useEffect(() => {
		const handleBackButton = () => {
			if (isSubmitting) {
				setIsSubmitting(false);
				dateMutation.reset();
			} else {
				// Handle normal back button behavior
			}
		};

		backButton.on('click', handleBackButton);

		return () => {
			backButton.off('click', handleBackButton);
		};
	}, [backButton, isSubmitting, dateMutation]);

	const footer = useMemo(() => {
		if (selectedDates.length === 0) {
			return <Text>{t('dateSelection.pickDaysPrompt')}</Text>;
		}
		const dateString = selectedDates
			.map(date => format(date, 'PP', { locale: locales[languageCode] || locales['en'] }))
			.join(', ');
		return (
			<Text>
				{t('dateSelection.selectedDates', { count: selectedDates.length, dates: dateString })}
			</Text>
		);
	}, [selectedDates, t, languageCode]);

	if (isSubmitting) return <Loading />;

	return (
		<div className={styles.container}>
			<h2 className={styles.title}>{t('dateSelection.title')}</h2>
			<DayPicker
				mode="multiple"
				weekStartsOn={1}
				min={1}
				max={5}
				selected={selectedDates}
				onSelect={days => setSelectedDates(days!)}
				footer={footer}
				disabled={isSubmitting}
				locale={locales[languageCode] || locales['en']}
			/>
		</div>
	);
};

export default DateSelection;
