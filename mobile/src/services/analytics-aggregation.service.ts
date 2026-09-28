/**
 * Analytics Aggregation Service - Data transformation and aggregation
 * Transforms raw analytics data into chart-ready formats
 */

interface DataPoint {
  value: number;
  label?: string;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
  target?: number;
}

class AnalyticsAggregationService {
  /**
   * Aggregate time series data by period
   */
  aggregateTimeSeries(
    data: TimeSeriesData[],
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' = 'daily'
  ): DataPoint[] {
    if (!data || data.length === 0) return [];

    const grouped = this.groupByPeriod(data, period);
    return Object.entries(grouped).map(([label, values]) => ({
      label,
      value: this.calculateAverage(values),
    }));
  }

  /**
   * Calculate percentage change between periods
   */
  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate trend direction
   */
  calculateTrend(data: number[]): 'up' | 'down' | 'stable' {
    if (data.length < 2) return 'stable';

    const firstHalf = this.calculateAverage(data.slice(0, Math.floor(data.length / 2)));
    const secondHalf = this.calculateAverage(data.slice(Math.floor(data.length / 2)));

    const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;

    if (percentChange > 2) return 'up';
    if (percentChange < -2) return 'down';
    return 'stable';
  }

  /**
   * Calculate forecast using simple linear regression
   */
  calculateForecast(historicalData: number[], forecastPeriods: number = 3) {
    if (historicalData.length < 2) {
      return historicalData.map(v => v);
    }

    const n = historicalData.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = historicalData.reduce((a, b) => a + b, 0);
    const sumXY = historicalData.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      forecast.push(intercept + slope * (n + i));
    }

    return forecast;
  }

  /**
   * Calculate confidence intervals
   */
  calculateConfidenceIntervals(
    data: number[],
    confidence: number = 0.95
  ): { lower: number; upper: number }[] {
    const mean = this.calculateAverage(data);
    const variance = this.calculateVariance(data, mean);
    const stdDev = Math.sqrt(variance);
    const stdError = stdDev / Math.sqrt(data.length);

    // Z-score for 95% confidence
    const zScore = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.65;
    const margin = zScore * stdError;

    return data.map(value => ({
      lower: value - margin,
      upper: value + margin,
    }));
  }

  /**
   * Detect anomalies using z-score method
   */
  detectAnomalies(data: number[], threshold: number = 2.5) {
    const mean = this.calculateAverage(data);
    const variance = this.calculateVariance(data, mean);
    const stdDev = Math.sqrt(variance);

    return data.map((value, index) => ({
      index,
      value,
      zScore: (value - mean) / stdDev,
      isAnomaly: Math.abs((value - mean) / stdDev) > threshold,
    }));
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(data: number[], windowSize: number = 3): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
      const window = data.slice(start, end);
      result.push(this.calculateAverage(window));
    }

    return result;
  }

  /**
   * Group data by category and sum
   */
  groupByCategory(data: { category: string; value: number }[]): DataPoint[] {
    const grouped = data.reduce(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.value;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(grouped).map(([label, value]) => ({
      label,
      value,
    }));
  }

  /**
   * Calculate KPI metrics
   */
  calculateKPI(data: TimeSeriesData[]) {
    if (data.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, variance: 0 };
    }

    const values = data.map(d => d.value);
    const current = values[values.length - 1];
    const average = this.calculateAverage(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = this.calculateVariance(values, average);

    return {
      current,
      average,
      min,
      max,
      variance,
      stdDev: Math.sqrt(variance),
      trend: this.calculateTrend(values),
    };
  }

  /**
   * Calculate performance metrics against targets
   */
  calculatePerformance(actual: number[], target: number[]) {
    if (actual.length !== target.length) {
      throw new Error('Actual and target arrays must have same length');
    }

    const performance = actual.map((a, i) => ({
      value: a,
      target: target[i],
      variance: a - target[i],
      percentageOfTarget: (a / target[i]) * 100,
    }));

    const avgPercentageOfTarget =
      performance.reduce((sum, p) => sum + p.percentageOfTarget, 0) / performance.length;

    return {
      items: performance,
      average: avgPercentageOfTarget,
      onTarget: avgPercentageOfTarget >= 95 && avgPercentageOfTarget <= 105,
    };
  }

  /**
   * Private helper methods
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateVariance(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private groupByPeriod(
    data: TimeSeriesData[],
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ): Record<string, number[]> {
    const grouped: Record<string, number[]> = {};

    data.forEach(item => {
      const date = new Date(item.timestamp);
      let key: string;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Week ${Math.floor(date.getDate() / 7 + 1)}`;
          break;
        case 'monthly':
          key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `Q${quarter} ${date.getFullYear()}`;
          break;
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item.value);
    });

    return grouped;
  }
}

export const analyticsAggregationService = new AnalyticsAggregationService();
