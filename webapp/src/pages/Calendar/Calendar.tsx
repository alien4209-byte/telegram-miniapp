import React from 'react';
import { DayPicker, SelectMultipleEventHandler } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Text } from '@telegram-apps/telegram-ui';
import { getCalendarByRef } from '@/api';
import 'react-day-picker/style.css';

interface CalendarProps {
	token: string;
	apiRef: string;
}

interface CalendarType {
	dates: string[];
}

const Calendar: React.FC<CalendarProps> = ({ token, apiRef }) => {
	const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);

	const { data, isLoading, error } = useQuery<{ calendar: CalendarType }, Error>({
		queryKey: ['calendar', apiRef],
		queryFn: () => getCalendarByRef(token, apiRef),
	});

	const disabledDays = React.useMemo(() => {
		if (!data) return undefined;
		const enabledDates = new Set(data.calendar.dates);
		return (date: Date) => !enabledDates.has(date.toISOString().split('T')[0]);
	}, [data]);

	const handleDaySelect: SelectMultipleEventHandler = dates => {
		if (dates) {
			setSelectedDates(dates);
		} else {
			setSelectedDates([]);
		}
	};

	if (isLoading) return <Spinner size="l" />;
	if (error) return <Text color="red">Error: {error.message}</Text>;

	return (
		<div>
			<h2>Pick out of proposed dates</h2>
			<DayPicker
				mode="multiple"
				selected={selectedDates}
				onSelect={handleDaySelect}
				disabled={disabledDays}
				footer={
					selectedDates.length > 0
						? `You picked ${selectedDates.length} date(s): ${selectedDates.map(date => date.toDateString()).join(', ')}`
						: 'Please pick one or more dates'
				}
			/>
		</div>
	);
};

export default Calendar;
