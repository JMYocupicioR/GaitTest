export const formatMetersPerSecond = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} m/s`;
};

export const formatCadence = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value)} pasos/min`;
};

export const formatMeters = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} m`;
};

export const formatSeconds = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} s`;
};

export const formatPercentage = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
};

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
};
