/**
 * Covenant Aggregation Service - Data transformation and compliance scoring
 * Calculates compliance scores, trends, and breach predictions
 */

interface CovenantValue {
  value: number;
  date: string;
  status: 'compliant' | 'warning' | 'breached';
}

class CovenantAggregationService {
  /**
   * Calculate overall compliance score (0-100%)
   */
  calculateComplianceScore(covenants: any[]): number {
    if (!covenants || covenants.length === 0) return 0;

    const statusWeights = {
      compliant: 100,
      warning: 50,
      breached: 0,
      pending: 75,
    };

    const totalScore = covenants.reduce((sum, c) => {
      return sum + (statusWeights[c.status as keyof typeof statusWeights] || 0);
    }, 0);

    return Math.round(totalScore / covenants.length);
  }

  /**
   * Calculate compliance score by category
   */
  calculateCategoryScores(covenants: any[]) {
    const categories: Record<string, any[]> = {};

    covenants.forEach(c => {
      if (!categories[c.category]) categories[c.category] = [];
      categories[c.category].push(c);
    });

    const scores: Record<string, number> = {};
    Object.entries(categories).forEach(([category, items]) => {
      scores[category] = this.calculateComplianceScore(items);
    });

    return scores;
  }

  /**
   * Determine covenant status based on current value
   */
  determineStatus(
    currentValue: number,
    threshold: number,
    warningThreshold: number,
    criticalThreshold: number,
    maxAcceptable?: number,
    minAcceptable?: number
  ): 'compliant' | 'warning' | 'breached' {
    // For ratios and metrics where lower is better
    if (maxAcceptable !== undefined) {
      if (currentValue > maxAcceptable) return 'breached';
      if (currentValue > warningThreshold) return 'warning';
      return 'compliant';
    }

    // For metrics where higher is better
    if (minAcceptable !== undefined) {
      if (currentValue < minAcceptable) return 'breached';
      if (currentValue < warningThreshold) return 'warning';
      return 'compliant';
    }

    // Default logic
    if (currentValue > criticalThreshold) return 'breached';
    if (currentValue > warningThreshold) return 'warning';
    return 'compliant';
  }

  /**
   * Calculate compliance trend
   */
  calculateTrend(historicalValues: CovenantValue[]): 'improving' | 'stable' | 'declining' {
    if (!historicalValues || historicalValues.length < 2) return 'stable';

    const firstHalf = historicalValues.slice(0, Math.floor(historicalValues.length / 2));
    const secondHalf = historicalValues.slice(Math.floor(historicalValues.length / 2));

    const firstAvg = this.calculateAverage(firstHalf.map(v => v.value));
    const secondAvg = this.calculateAverage(secondHalf.map(v => v.value));

    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (percentChange > 5) return 'improving';
    if (percentChange < -5) return 'declining';
    return 'stable';
  }

  /**
   * Forecast covenant breach using simple trend
   */
  forecastBreach(
    historicalValues: CovenantValue[],
    threshold: number,
    periods: number = 3
  ): boolean {
    if (historicalValues.length < 2) return false;

    const values = historicalValues.map(v => v.value);
    const forecast = this.linearForecast(values, periods);

    // Check if any forecasted value exceeds threshold
    return forecast.some(v => v > threshold);
  }

  /**
   * Calculate days until threshold breach
   */
  calculateDaysUntilBreach(
    historicalValues: CovenantValue[],
    threshold: number,
    maxAcceptable?: number
  ): number | null {
    if (historicalValues.length < 2) return null;

    const values = historicalValues.map(v => v.value);
    const rate = this.calculateChangeRate(values);

    if (rate === 0) return null;

    const currentValue = values[values.length - 1];
    const breachValue = maxAcceptable || threshold;

    if (rate > 0 && currentValue > breachValue) {
      return 0; // Already breached
    }

    if (rate > 0) {
      return Math.ceil((breachValue - currentValue) / rate);
    }

    return null;
  }

  /**
   * Severity level for breach
   */
  calculateBreachSeverity(
    currentValue: number,
    threshold: number,
    criticalThreshold: number,
    historicalDays: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const deviationPercent = Math.abs((currentValue - threshold) / threshold) * 100;
    const daysBreached = historicalDays;

    // Critical: far from threshold + long duration
    if (deviationPercent > 20 && daysBreached > 30) return 'critical';

    // High: significant deviation or medium duration
    if (deviationPercent > 15 || daysBreached > 14) return 'high';

    // Medium: moderate deviation
    if (deviationPercent > 8) return 'medium';

    // Low: minor deviation
    return 'low';
  }

  /**
   * Calculate compliance summary
   */
  calculateSummary(covenants: any[]) {
    const total = covenants.length;
    const compliant = covenants.filter(c => c.status === 'compliant').length;
    const warning = covenants.filter(c => c.status === 'warning').length;
    const breached = covenants.filter(c => c.status === 'breached').length;
    const pending = covenants.filter(c => c.status === 'pending').length;

    return {
      total,
      compliant,
      warning,
      breached,
      pending,
      compliancePercent: (compliant / total) * 100,
      riskLevel: breached > 0 ? 'high' : warning > 0 ? 'medium' : 'low',
    };
  }

  /**
   * Identify at-risk covenants
   */
  identifyAtRisk(covenants: any[], threshold: number = 30): any[] {
    return covenants
      .filter(c => c.status !== 'compliant' && c.status !== 'breached')
      .map(c => ({
        ...c,
        riskScore: this.calculateRiskScore(c),
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, Math.ceil(covenants.length * threshold / 100));
  }

  /**
   * Calculate risk score for covenant (0-100)
   */
  private calculateRiskScore(covenant: any): number {
    let score = 0;

    // Status contribution (40%)
    if (covenant.status === 'breached') score += 40;
    else if (covenant.status === 'warning') score += 20;

    // Value proximity to threshold (30%)
    if (covenant.currentValue && covenant.maxAcceptable) {
      const proximity = (covenant.currentValue / covenant.maxAcceptable) * 30;
      score += Math.min(proximity, 30);
    }

    // Duration of warning/breach (20%)
    if (covenant.breachStartDate) {
      const days = Math.floor(
        (Date.now() - new Date(covenant.breachStartDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const durationScore = Math.min(days / 30 * 20, 20);
      score += durationScore;
    }

    // Frequency (10%)
    const frequencyScores: Record<string, number> = {
      daily: 10,
      weekly: 8,
      monthly: 6,
      quarterly: 4,
      annual: 2,
    };
    score += frequencyScores[covenant.frequency] || 0;

    return Math.round(score);
  }

  /**
   * Group covenants by status
   */
  groupByStatus(covenants: any[]) {
    return {
      compliant: covenants.filter(c => c.status === 'compliant'),
      warning: covenants.filter(c => c.status === 'warning'),
      breached: covenants.filter(c => c.status === 'breached'),
      pending: covenants.filter(c => c.status === 'pending'),
    };
  }

  /**
   * Generate compliance report data
   */
  generateReportData(covenants: any[], breaches: any[], records: any[]) {
    return {
      summary: this.calculateSummary(covenants),
      categoryScores: this.calculateCategoryScores(covenants),
      grouped: this.groupByStatus(covenants),
      atRisk: this.identifyAtRisk(covenants),
      breachSummary: {
        total: breaches.length,
        active: breaches.filter((b: any) => b.status === 'active').length,
        cured: breaches.filter((b: any) => b.status === 'cured').length,
        waived: breaches.filter((b: any) => b.status === 'waived').length,
      },
      trend: this.calculateTrend(records),
    };
  }

  /**
   * Private helpers
   */
  private calculateAverage(values: number[]): number {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private linearForecast(values: number[], periods: number): number[] {
    if (values.length < 2) return Array(periods).fill(values[0] || 0);

    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast = [];
    for (let i = 1; i <= periods; i++) {
      forecast.push(intercept + slope * (n + i));
    }

    return forecast;
  }

  private calculateChangeRate(values: number[]): number {
    if (values.length < 2) return 0;

    const recentChanges = [];
    for (let i = 1; i < Math.min(values.length, 6); i++) {
      recentChanges.push(values[i] - values[i - 1]);
    }

    return this.calculateAverage(recentChanges);
  }
}

export const covenantAggregationService = new CovenantAggregationService();
