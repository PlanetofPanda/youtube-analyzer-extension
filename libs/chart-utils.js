/**
 * Chart Utilities
 * 提供数据可视化功能，用于生成图表和视觉化展示YouTube分析数据。
 * 基于Canvas和SVG技术实现，不依赖外部库。
 */

import dataProcessor from './data-processor.js';

class ChartUtils {
    constructor() {
        // 默认配置
        this.defaultColors = [
            '#4285F4', // 蓝色
            '#34A853', // 绿色
            '#FBBC05', // 黄色
            '#EA4335', // 红色
            '#8ab4f8', // 浅蓝
            '#c5221f', // 深红
            '#16a765', // 深绿
            '#f6c945', // 深黄
            '#9c27b0', // 紫色
            '#3949ab'  // 靛蓝
        ];
    }

    /**
     * 创建一个新的canvas元素。
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     * @returns {HTMLCanvasElement} - 新的canvas元素
     */
    createCanvas(width = 400, height = 300) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.backgroundColor = '#fff';
        canvas.style.borderRadius = '8px';
        canvas.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        return canvas;
    }

    /**
     * 绘制条形图。
     * @param {Object} config - 图表配置
     * @param {HTMLElement} container - 容器元素
     * @returns {HTMLCanvasElement} - 图表Canvas元素
     */
    createBarChart(config, container) {
        const {
            data,
            labels,
            title = '',
            width = 400,
            height = 300,
            colors = this.defaultColors,
            showValues = true,
            showLegend = false,
            valueFormatter = (value) => value.toString()
        } = config;
        
        if (!data || !labels || data.length !== labels.length) {
            console.error('Chart Utils: Invalid data for bar chart');
            return null;
        }
        
        // 创建canvas
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // 设置边距
        const margin = {
            top: title ? 40 : 20,
            right: 20,
            bottom: 60,
            left: 50
        };
        
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // 绘制标题
        if (title) {
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#333';
            ctx.fillText(title, width / 2, margin.top / 2 + 10);
        }
        
        // 计算最大值确定Y轴刻度
        const maxValue = Math.max(...data) * 1.1; // 增加10%的空间
        
        // 计算条形宽度和间距
        const barCount = data.length;
        const barWidth = chartWidth / barCount * 0.7;
        const barSpacing = chartWidth / barCount * 0.3;
        
        // 绘制Y轴
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        ctx.strokeStyle = '#ddd';
        ctx.stroke();
        
        // 绘制Y轴刻度
        const yTickCount = 5;
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#666';
        
        for (let i = 0; i <= yTickCount; i++) {
            const value = maxValue * (i / yTickCount);
            const y = height - margin.bottom - (chartHeight * (i / yTickCount));
            
            // 绘制刻度线
            ctx.beginPath();
            ctx.moveTo(margin.left - 5, y);
            ctx.lineTo(margin.left, y);
            ctx.strokeStyle = '#ddd';
            ctx.stroke();
            
            // 绘制刻度值
            ctx.fillText(Math.round(value).toLocaleString(), margin.left - 10, y + 4);
            
            // 绘制网格线
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.strokeStyle = '#f0f0f0';
            ctx.stroke();
        }
        
        // 绘制条形
        for (let i = 0; i < barCount; i++) {
            const value = data[i];
            const x = margin.left + (i * (chartWidth / barCount)) + (barSpacing / 2);
            const barHeight = (value / maxValue) * chartHeight;
            const y = height - margin.bottom - barHeight;
            
            // 绘制条形
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // 绘制数值
            if (showValues) {
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#333';
                ctx.fillText(valueFormatter(value), x + barWidth / 2, y - 5);
            }
            
            // 绘制X轴标签
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#666';
            
            // 标签旋转处理
            const label = labels[i];
            if (label.length > 10) {
                ctx.save();
                ctx.translate(x + barWidth / 2, height - margin.bottom + 15);
                ctx.rotate(Math.PI / 6); // 30度角
                ctx.fillText(label, 0, 0);
                ctx.restore();
            } else {
                ctx.fillText(label, x + barWidth / 2, height - margin.bottom + 15);
            }
        }
        
        // 绘制图例
        if (showLegend && labels.length > 0) {
            const legendX = margin.left;
            const legendY = height - 20;
            const legendItemWidth = chartWidth / labels.length;
            
            for (let i = 0; i < labels.length; i++) {
                const x = legendX + (i * legendItemWidth);
                
                // 绘制颜色方块
                ctx.fillStyle = colors[i % colors.length];
                ctx.fillRect(x, legendY, 10, 10);
                
                // 绘制标签
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#666';
                ctx.fillText(labels[i], x + 15, legendY + 8);
            }
        }
        
        // 添加到容器
        if (container) {
            container.appendChild(canvas);
        }
        
        return canvas;
    }

    /**
     * 绘制饼图。
     * @param {Object} config - 图表配置
     * @param {HTMLElement} container - 容器元素
     * @returns {HTMLCanvasElement} - 图表Canvas元素
     */
    createPieChart(config, container) {
        const {
            data,
            labels,
            title = '',
            width = 400,
            height = 400,
            colors = this.defaultColors,
            showValues = true,
            showLegend = true,
            valueFormatter = (value, total) => `${Math.round(value / total * 100)}%`
        } = config;
        
        if (!data || !labels || data.length !== labels.length) {
            console.error('Chart Utils: Invalid data for pie chart');
            return null;
        }
        
        // 创建canvas
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // 设置边距和圆心
        const margin = {
            top: title ? 40 : 20,
            right: 20,
            bottom: showLegend ? 80 : 20,
            left: 20
        };
        
        const centerX = width / 2;
        const centerY = (height - margin.bottom + margin.top) / 2;
        const radius = Math.min(centerX - margin.left, centerY - margin.top) * 0.8;
        
        // 绘制标题
        if (title) {
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#333';
            ctx.fillText(title, width / 2, margin.top / 2 + 10);
        }
        
        // 计算总和
        const total = data.reduce((sum, value) => sum + value, 0);
        
        // 绘制饼图
        let startAngle = -0.5 * Math.PI; // 从顶部开始
        
        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            const sliceAngle = (value / total) * (2 * Math.PI);
            const endAngle = startAngle + sliceAngle;
            const midAngle = startAngle + sliceAngle / 2;
            
            // 绘制扇形
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            
            // 绘制数值标签
            if (showValues && value / total > 0.05) { // 只有当扇区足够大时才显示标签
                const labelRadius = radius * 0.7;
                const labelX = centerX + labelRadius * Math.cos(midAngle);
                const labelY = centerY + labelRadius * Math.sin(midAngle);
                
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                ctx.fillText(valueFormatter(value, total), labelX, labelY);
            }
            
            startAngle = endAngle;
        }
        
        // 绘制图例
        if (showLegend) {
            const legendTop = height - margin.bottom + 20;
            const legendItemHeight = 20;
            const legendRows = Math.ceil(labels.length / 3);
            const legendItemWidth = width / 3;
            
            for (let i = 0; i < labels.length; i++) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const x = margin.left + col * legendItemWidth;
                const y = legendTop + row * legendItemHeight;
                
                // 绘制颜色方块
                ctx.fillStyle = colors[i % colors.length];
                ctx.fillRect(x, y, 10, 10);
                
                // 绘制标签和值
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#666';
                ctx.fillText(`${labels[i]} (${valueFormatter(data[i], total)})`, x + 15, y);
            }
        }
        
        // 添加到容器
        if (container) {
            container.appendChild(canvas);
        }
        
        return canvas;
    }

    /**
     * 绘制折线图。
     * @param {Object} config - 图表配置
     * @param {HTMLElement} container - 容器元素
     * @returns {HTMLCanvasElement} - 图表Canvas元素
     */
    createLineChart(config, container) {
        const {
            datasets,
            labels,
            title = '',
            width = 600,
            height = 400,
            colors = this.defaultColors,
            showPoints = true,
            showLegend = true,
            valueFormatter = (value) => value.toString()
        } = config;
        
        if (!datasets || !labels || datasets.length === 0) {
            console.error('Chart Utils: Invalid data for line chart');
            return null;
        }
        
        // 创建canvas
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // 设置边距
        const margin = {
            top: title ? 40 : 20,
            right: 20,
            bottom: 60,
            left: 50
        };
        
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // 绘制标题
        if (title) {
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#333';
            ctx.fillText(title, width / 2, margin.top / 2 + 10);
        }
        
        // 找出所有数据集中的最大值
        let maxValue = 0;
        for (const dataset of datasets) {
            const dataMax = Math.max(...dataset.data);
            maxValue = Math.max(maxValue, dataMax);
        }
        maxValue *= 1.1; // 增加10%的空间
        
        // 绘制Y轴
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        ctx.strokeStyle = '#ddd';
        ctx.stroke();
        
        // 绘制X轴
        ctx.beginPath();
        ctx.moveTo(margin.left, height - margin.bottom);
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.strokeStyle = '#ddd';
        ctx.stroke();
        
        // 绘制Y轴刻度
        const yTickCount = 5;
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#666';
        
        for (let i = 0; i <= yTickCount; i++) {
            const value = maxValue * (i / yTickCount);
            const y = height - margin.bottom - (chartHeight * (i / yTickCount));
            
            // 绘制刻度线
            ctx.beginPath();
            ctx.moveTo(margin.left - 5, y);
            ctx.lineTo(margin.left, y);
            ctx.strokeStyle = '#ddd';
            ctx.stroke();
            
            // 绘制刻度值
            ctx.fillText(valueFormatter(Math.round(value)), margin.left - 10, y + 4);
            
            // 绘制网格线
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.strokeStyle = '#f0f0f0';
            ctx.stroke();
        }
        
        // 绘制X轴标签
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        for (let i = 0; i < labels.length; i++) {
            const x = margin.left + (i / (labels.length - 1)) * chartWidth;
            
            // 绘制刻度线
            ctx.beginPath();
            ctx.moveTo(x, height - margin.bottom);
            ctx.lineTo(x, height - margin.bottom + 5);
            ctx.strokeStyle = '#ddd';
            ctx.stroke();
            
            // 旋转长标签
            const label = labels[i];
            if (label.length > 8) {
                ctx.save();
                ctx.translate(x, height - margin.bottom + 10);
                ctx.rotate(Math.PI / 4); // 45度角
                ctx.fillText(label, 0, 0);
                ctx.restore();
            } else {
                ctx.fillText(label, x, height - margin.bottom + 10);
            }
        }
        
        // 绘制每个数据集
        for (let d = 0; d < datasets.length; d++) {
            const dataset = datasets[d];
            const color = colors[d % colors.length];
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let i = 0; i < dataset.data.length; i++) {
                const value = dataset.data[i];
                const x = margin.left + (i / (dataset.data.length - 1)) * chartWidth;
                const y = height - margin.bottom - (value / maxValue) * chartHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                // 绘制数据点
                if (showPoints) {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // 标出数据点的值
                    if (dataset.showValues) {
                        ctx.font = '10px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#333';
                        ctx.fillText(valueFormatter(value), x, y - 10);
                    }
                }
            }
            
            ctx.stroke();
        }
        
        // 绘制图例
        if (showLegend && datasets.length > 0) {
            const legendItemWidth = chartWidth / datasets.length;
            const legendY = height - 20;
            
            for (let i = 0; i < datasets.length; i++) {
                const x = margin.left + (i * legendItemWidth);
                const color = colors[i % colors.length];
                
                // 绘制线条示例
                ctx.beginPath();
                ctx.moveTo(x, legendY);
                ctx.lineTo(x + 15, legendY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 绘制点
                if (showPoints) {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(x + 8, legendY, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // 绘制标签
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#666';
                ctx.fillText(datasets[i].label, x + 20, legendY + 3);
            }
        }
        
        // 添加到容器
        if (container) {
            container.appendChild(canvas);
        }
        
        return canvas;
    }

    /**
     * 创建视频性能仪表盘。
     * @param {Object} videoData - 视频数据
     * @param {HTMLElement} container - 容器元素
     */
    createVideoPerformanceDashboard(videoData, container) {
        if (!videoData || !container) {
            console.error('Chart Utils: Invalid data or container for video dashboard');
            return;
        }
        
        // 处理数据
        const kpis = dataProcessor.calculateVideoKPIs(videoData);
        if (kpis.error) {
            container.innerHTML = `<p class="error">${kpis.error}</p>`;
            return;
        }
        
        // 创建仪表盘容器
        const dashboardEl = document.createElement('div');
        dashboardEl.className = 'performance-dashboard';
        dashboardEl.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        // 添加标题
        const titleEl = document.createElement('h3');
        titleEl.textContent = '视频性能分析';
        titleEl.style.cssText = `
            margin: 0 0 10px 0;
            color: #333;
            font-size: 18px;
            text-align: center;
        `;
        dashboardEl.appendChild(titleEl);
        
        // 创建性能评分展示
        const scoreContainer = document.createElement('div');
        scoreContainer.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 20px;
        `;
        
        const scoreEl = this.createScoreGauge(kpis.performanceScore);
        scoreContainer.appendChild(scoreEl);
        dashboardEl.appendChild(scoreContainer);
        
        // 创建指标网格
        const metricsGrid = document.createElement('div');
        metricsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        `;
        
        // 添加关键指标
        const metrics = [
            { label: '总观看量', value: kpis.viewCount.toLocaleString(), icon: '👁️' },
            { label: '点赞数', value: kpis.likeCount.toLocaleString(), icon: '👍' },
            { label: '点赞率', value: `${kpis.likeViewRatio}%`, icon: '📊' },
            { label: '评论数', value: kpis.commentCount.toLocaleString(), icon: '💬' },
            { label: '每日平均观看', value: kpis.dailyViewCount.toLocaleString(), icon: '📈' },
            { label: '参与度', value: `${kpis.engagementRate}%`, icon: '🔄' }
        ];
        
        metrics.forEach(metric => {
            const metricEl = document.createElement('div');
            metricEl.style.cssText = `
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            `;
            
            metricEl.innerHTML = `
                <div style="font-size: 20px; margin-bottom: 8px;">${metric.icon}</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">${metric.label}</div>
                <div style="font-size: 16px; font-weight: bold; color: #333;">${metric.value}</div>
            `;
            
            metricsGrid.appendChild(metricEl);
        });
        
        dashboardEl.appendChild(metricsGrid);
        
        // 添加到容器
        container.appendChild(dashboardEl);
    }

    /**
     * 创建频道性能仪表盘。
     * @param {Object} channelData - 频道数据
     * @param {HTMLElement} container - 容器元素
     */
    createChannelPerformanceDashboard(channelData, container) {
        if (!channelData || !container) {
            console.error('Chart Utils: Invalid data or container for channel dashboard');
            return;
        }
        
        // 处理数据
        const kpis = dataProcessor.calculateChannelKPIs(channelData);
        if (kpis.error) {
            container.innerHTML = `<p class="error">${kpis.error}</p>`;
            return;
        }
        
        // 创建仪表盘容器
        const dashboardEl = document.createElement('div');
        dashboardEl.className = 'channel-dashboard';
        dashboardEl.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        // 添加标题
        const titleEl = document.createElement('h3');
        titleEl.textContent = '频道性能分析';
        titleEl.style.cssText = `
            margin: 0 0 10px 0;
            color: #333;
            font-size: 18px;
            text-align: center;
        `;
        dashboardEl.appendChild(titleEl);
        
        // 创建频道健康分数展示
        const scoreContainer = document.createElement('div');
        scoreContainer.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 20px;
        `;
        
        const scoreEl = this.createScoreGauge(kpis.channelScore);
        scoreContainer.appendChild(scoreEl);
        dashboardEl.appendChild(scoreContainer);
        
        // 创建指标网格
        const metricsGrid = document.createElement('div');
        metricsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        `;
        
        // 添加关键指标
        const metrics = [
            { label: '订阅者数', value: kpis.subscriberCount.toLocaleString(), icon: '👥' },
            { label: '总观看量', value: kpis.viewCount.toLocaleString(), icon: '👁️' },
            { label: '视频数量', value: kpis.videoCount.toLocaleString(), icon: '🎬' },
            { label: '每月订阅增长', value: kpis.monthlySubscriberGrowth.toLocaleString(), icon: '📈' },
            { label: '每视频观看量', value: kpis.viewsPerVideo.toLocaleString(), icon: '🔄' },
            { label: '每月视频产出', value: kpis.videosPerMonth.toFixed(1), icon: '📆' }
        ];
        
        metrics.forEach(metric => {
            const metricEl = document.createElement('div');
            metricEl.style.cssText = `
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            `;
            
            metricEl.innerHTML = `
                <div style="font-size: 20px; margin-bottom: 8px;">${metric.icon}</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">${metric.label}</div>
                <div style="font-size: 16px; font-weight: bold; color: #333;">${metric.value}</div>
            `;
            
            metricsGrid.appendChild(metricEl);
        });
        
        dashboardEl.appendChild(metricsGrid);
        
        // 添加到容器
        container.appendChild(dashboardEl);
    }

    /**
     * 创建评论情感分析可视化。
     * @param {Object} sentimentData - 情感分析数据
     * @param {HTMLElement} container - 容器元素
     */
    createSentimentVisualization(sentimentData, container) {
        if (!sentimentData || !container) {
            console.error('Chart Utils: Invalid data or container for sentiment visualization');
            return;
        }
        
        // 创建容器
        const sentimentEl = document.createElement('div');
        sentimentEl.className = 'sentiment-visualization';
        sentimentEl.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        // 添加标题
        const titleEl = document.createElement('h3');
        titleEl.textContent = '评论情感分析';
        titleEl.style.cssText = `
            margin: 0 0 10px 0;
            color: #333;
            font-size: 18px;
            text-align: center;
        `;
        sentimentEl.appendChild(titleEl);
        
        // 创建情感分布饼图
        const distributionContainer = document.createElement('div');
        
        if (sentimentData.commentCount > 0) {
            this.createPieChart({
                data: [
                    sentimentData.sentimentDistribution.positive,
                    sentimentData.sentimentDistribution.neutral,
                    sentimentData.sentimentDistribution.negative
                ],
                labels: ['积极', '中性', '消极'],
                title: '评论情感分布',
                width: 300,
                height: 250,
                colors: ['#34A853', '#FBBC05', '#EA4335']
            }, distributionContainer);
            
            // 添加整体情感评分
            const scoreContainer = document.createElement('div');
            scoreContainer.style.cssText = `
                text-align: center;
                margin-top: 10px;
            `;
            
            scoreContainer.innerHTML = `
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">整体情感评分</div>
                <div style="font-size: 24px; font-weight: bold; color: ${this.getSentimentColor(sentimentData.sentimentScore)};">
                    ${sentimentData.sentimentScore.toFixed(1)}
                </div>
                <div style="font-size: 13px; color: #666; margin-top: 5px;">
                    ${sentimentData.sentimentAssessment}
                </div>
            `;
            
            distributionContainer.appendChild(scoreContainer);
        } else {
            distributionContainer.innerHTML = `<p style="text-align: center; color: #666;">没有评论数据可供分析</p>`;
        }
        
        sentimentEl.appendChild(distributionContainer);
        
        // 添加到容器
        container.appendChild(sentimentEl);
    }

    /**
     * 根据情感分数返回对应的颜色。
     * @param {number} score - 情感分数 (-100 到 100)
     * @returns {string} - 颜色代码
     */
    getSentimentColor(score) {
        if (score >= 60) return '#00C853'; // 深绿
        if (score >= 20) return '#7CB342'; // 绿
        if (score >= 0) return '#C0CA33';  // 黄绿
        if (score >= -20) return '#FFB300'; // 琥珀
        if (score >= -60) return '#F57C00'; // 橙
        return '#D50000'; // 红
    }

    /**
     * 创建分数仪表盘。
     * @param {number} score - 分数 (0-100)
     * @returns {HTMLCanvasElement} - 仪表盘Canvas元素
     */
    createScoreGauge(score) {
        const size = 150;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        
        const ctx = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.4;
        
        // 绘制背景圆环
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#f0f0f0';
        ctx.stroke();
        
        // 绘制分数圆环
        const angle = (score / 100) * 1.5 * Math.PI + 0.75 * Math.PI;
        
        // 获取颜色
        let color;
        if (score >= 80) color = '#00C853'; // 深绿
        else if (score >= 60) color = '#7CB342'; // 绿
        else if (score >= 40) color = '#C0CA33'; // 黄绿
        else if (score >= 20) color = '#FFB300'; // 琥珀
        else color = '#F57C00'; // 橙
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, angle);
        ctx.lineWidth = 10;
        ctx.strokeStyle = color;
        ctx.stroke();
        
        // 绘制分数文本
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(score.toString(), centerX, centerY);
        
        // 绘制标签
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('性能评分', centerX, centerY + 30);
        
        return canvas;
    }

    /**
     * 创建标签云可视化。
     * @param {Object} tagAnalysisData - 标签分析数据
     * @param {HTMLElement} container - 容器元素
     */
    createTagCloud(tagAnalysisData, container) {
        if (!tagAnalysisData || !container || tagAnalysisData.error) {
            if (container) {
                container.innerHTML = `<p class="error">${tagAnalysisData?.error || '无效的标签数据'}</p>`;
            }
            return;
        }
        
        // 创建标签云容器
        const cloudContainer = document.createElement('div');
        cloudContainer.className = 'tag-cloud';
        cloudContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        // 添加标题
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
            width: 100%;
            text-align: center;
            margin-bottom: 15px;
        `;
        titleEl.innerHTML = `
            <h3 style="margin: 0 0 5px 0; color: #333; font-size: 18px;">标签分析</h3>
            <div style="font-size: 13px; color: #666;">
                ${tagAnalysisData.tagCount} 个标签 • 平均长度: ${tagAnalysisData.avgTagLength} 字符
            </div>
        `;
        cloudContainer.appendChild(titleEl);
        
        // 添加标签评估
        const assessmentEl = document.createElement('div');
        assessmentEl.style.cssText = `
            width: 100%;
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 14px;
            color: #555;
        `;
        assessmentEl.textContent = tagAnalysisData.tagQuantityAssessment;
        cloudContainer.appendChild(assessmentEl);
        
        // 计算标签字体大小
        const calculateFontSize = (index, total) => {
            const minSize = 12;
            const maxSize = 20;
            const step = (maxSize - minSize) / (total - 1 || 1);
            return maxSize - (index * step);
        };
        
        // 添加标签
        tagAnalysisData.tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.textContent = tag;
            
            // 随机颜色但保持在蓝色调范围内
            const hue = 180 + Math.floor(Math.random() * 60);
            const saturation = 70 + Math.floor(Math.random() * 30);
            const lightness = 35 + Math.floor(Math.random() * 25);
            
            tagEl.style.cssText = `
                display: inline-block;
                padding: 6px 12px;
                background-color: hsl(${hue}, ${saturation}%, ${lightness}%);
                color: white;
                border-radius: 20px;
                font-size: ${calculateFontSize(index, tagAnalysisData.tags.length)}px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;
            
            cloudContainer.appendChild(tagEl);
        });
        
        // 添加常用词汇
        if (tagAnalysisData.mostFrequentWords && tagAnalysisData.mostFrequentWords.length > 0) {
            const wordsSection = document.createElement('div');
            wordsSection.style.cssText = `
                width: 100%;
                margin-top: 20px;
            `;
            
            const wordsTitleEl = document.createElement('h4');
            wordsTitleEl.textContent = '最常用的关键词';
            wordsTitleEl.style.cssText = `
                margin: 0 0 10px 0;
                color: #333;
                font-size: 16px;
                text-align: center;
            `;
            wordsSection.appendChild(wordsTitleEl);
            
            const wordsContainer = document.createElement('div');
            wordsContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            `;
            
            tagAnalysisData.mostFrequentWords.forEach(word => {
                const wordEl = document.createElement('span');
                wordEl.textContent = `${word.word} (${word.count})`;
                wordEl.style.cssText = `
                    display: inline-block;
                    padding: 4px 10px;
                    background-color: #f0f0f0;
                    color: #333;
                    border-radius: 15px;
                    font-size: 13px;
                `;
                
                wordsContainer.appendChild(wordEl);
            });
            
            wordsSection.appendChild(wordsContainer);
            cloudContainer.appendChild(wordsSection);
        }
        
        // 添加到容器
        container.appendChild(cloudContainer);
    }
}

// 导出单例实例
const chartUtils = new ChartUtils();
export default chartUtils;