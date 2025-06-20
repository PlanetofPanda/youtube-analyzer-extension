/**
 * Data Processor
 * 提供YouTube数据分析处理功能，包括统计分析、标签分析、评论情感分析等。
 */

import youTubeApiClient from './api-client.js';

class DataProcessor {
    constructor() {
        // 初始化情感分析词典（简单示例）
        this.sentimentDictionary = {
            positive: [
                '喜欢', '赞', '支持', '好看', '精彩', '棒', '帅', '厉害', '感谢', '谢谢', 
                '爱', '漂亮', '优秀', '完美', '推荐', '好', '牛', '震撼', '赞赏', '学习',
                'love', 'like', 'good', 'great', 'excellent', 'amazing', 'awesome', 
                'beautiful', 'best', 'thanks', 'thank', 'cool', 'nice', 'perfect', 
                'recommend', 'helpful', 'impressive', 'wonderful', 'enjoy', 'enjoyed'
            ],
            negative: [
                '差', '烂', '不好', '讨厌', '难看', '垃圾', '失望', '无聊', '浪费', '糟糕',
                '弱', '坑', '骗', '假', '水', '敷衍', '难受', '辣眼睛', '花里胡哨', '太长',
                'bad', 'worst', 'terrible', 'horrible', 'boring', 'waste', 'poor', 
                'disappointed', 'disappointing', 'hate', 'awful', 'dislike', 'useless',
                'stupid', 'sucks', 'fake', 'clickbait', 'misleading', 'annoying', 'ugly'
            ]
        };
    }

    /**
     * 计算视频的关键绩效指标（KPI）。
     * @param {Object} videoData - 视频数据对象
     * @returns {Object} - 包含KPI的对象
     */
    calculateVideoKPIs(videoData) {
        if (!videoData || !videoData.statistics) {
            return {
                error: "无效的视频数据"
            };
        }

        const stats = videoData.statistics;
        const viewCount = parseInt(stats.viewCount) || 0;
        const likeCount = parseInt(stats.likeCount) || 0;
        const commentCount = parseInt(stats.commentCount) || 0;
        const dislikeCount = parseInt(stats.dislikeCount) || 0; // YouTube API不再返回此值

        // 计算关键指标
        const likeViewRatio = viewCount > 0 ? (likeCount / viewCount) * 100 : 0;
        const commentViewRatio = viewCount > 0 ? (commentCount / viewCount) * 100 : 0;
        const engagementRate = viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0;

        // 视频发布时间
        const publishedAt = new Date(videoData.snippet.publishedAt);
        const now = new Date();
        const daysSincePublished = Math.floor((now - publishedAt) / (1000 * 60 * 60 * 24));

        // 平均每日观看量
        const dailyViewCount = daysSincePublished > 0 ? viewCount / daysSincePublished : viewCount;

        // 创建视频性能分数（满分100）
        let performanceScore = 0;
        
        // 根据点赞率评分（最多40分）
        if (likeViewRatio > 15) performanceScore += 40;
        else if (likeViewRatio > 10) performanceScore += 35;
        else if (likeViewRatio > 5) performanceScore += 30;
        else if (likeViewRatio > 3) performanceScore += 25;
        else if (likeViewRatio > 1) performanceScore += 20;
        else if (likeViewRatio > 0.5) performanceScore += 15;
        else if (likeViewRatio > 0.1) performanceScore += 10;
        else performanceScore += 5;
        
        // 根据评论率评分（最多30分）
        if (commentViewRatio > 1) performanceScore += 30;
        else if (commentViewRatio > 0.5) performanceScore += 25;
        else if (commentViewRatio > 0.3) performanceScore += 20;
        else if (commentViewRatio > 0.1) performanceScore += 15;
        else if (commentViewRatio > 0.05) performanceScore += 10;
        else performanceScore += 5;
        
        // 根据观看量评分（最多30分）
        if (viewCount > 1000000) performanceScore += 30;
        else if (viewCount > 500000) performanceScore += 27;
        else if (viewCount > 100000) performanceScore += 24;
        else if (viewCount > 50000) performanceScore += 21;
        else if (viewCount > 10000) performanceScore += 18;
        else if (viewCount > 5000) performanceScore += 15;
        else if (viewCount > 1000) performanceScore += 12;
        else if (viewCount > 500) performanceScore += 9;
        else if (viewCount > 100) performanceScore += 6;
        else performanceScore += 3;

        return {
            viewCount,
            likeCount,
            commentCount,
            likeViewRatio: parseFloat(likeViewRatio.toFixed(2)),
            commentViewRatio: parseFloat(commentViewRatio.toFixed(2)),
            engagementRate: parseFloat(engagementRate.toFixed(2)),
            daysSincePublished,
            dailyViewCount: parseFloat(dailyViewCount.toFixed(2)),
            performanceScore: Math.min(100, Math.round(performanceScore))
        };
    }

    /**
     * 计算频道的关键绩效指标（KPI）。
     * @param {Object} channelData - 频道数据对象
     * @returns {Object} - 包含KPI的对象
     */
    calculateChannelKPIs(channelData) {
        if (!channelData || !channelData.statistics) {
            return {
                error: "无效的频道数据"
            };
        }

        const stats = channelData.statistics;
        const subscriberCount = parseInt(stats.subscriberCount) || 0;
        const viewCount = parseInt(stats.viewCount) || 0;
        const videoCount = parseInt(stats.videoCount) || 0;

        // 计算关键指标
        const viewsPerVideo = videoCount > 0 ? viewCount / videoCount : 0;
        const subscribersPerVideo = videoCount > 0 ? subscriberCount / videoCount : 0;
        const viewsPerSubscriber = subscriberCount > 0 ? viewCount / subscriberCount : 0;

        // 频道创建时间
        const publishedAt = new Date(channelData.snippet.publishedAt);
        const now = new Date();
        const daysSinceCreated = Math.floor((now - publishedAt) / (1000 * 60 * 60 * 24));
        const monthsSinceCreated = Math.floor(daysSinceCreated / 30);
        const yearsSinceCreated = Math.floor(daysSinceCreated / 365);

        // 平均每日/每月/每年数据
        const dailySubscriberGrowth = daysSinceCreated > 0 ? subscriberCount / daysSinceCreated : subscriberCount;
        const monthlySubscriberGrowth = monthsSinceCreated > 0 ? subscriberCount / monthsSinceCreated : subscriberCount;
        const yearlySubscriberGrowth = yearsSinceCreated > 0 ? subscriberCount / yearsSinceCreated : subscriberCount;

        const dailyViewGrowth = daysSinceCreated > 0 ? viewCount / daysSinceCreated : viewCount;
        const monthlyViewGrowth = monthsSinceCreated > 0 ? viewCount / monthsSinceCreated : viewCount;
        const yearlyViewGrowth = yearsSinceCreated > 0 ? viewCount / yearsSinceCreated : viewCount;

        const videosPerMonth = monthsSinceCreated > 0 ? videoCount / monthsSinceCreated : videoCount;
        const videosPerYear = yearsSinceCreated > 0 ? videoCount / yearsSinceCreated : videoCount;

        // 创建频道健康分数（满分100）
        let channelScore = 0;
        
        // 基于订阅者数（最多40分）
        if (subscriberCount > 1000000) channelScore += 40;
        else if (subscriberCount > 500000) channelScore += 36;
        else if (subscriberCount > 100000) channelScore += 32;
        else if (subscriberCount > 50000) channelScore += 28;
        else if (subscriberCount > 10000) channelScore += 24;
        else if (subscriberCount > 5000) channelScore += 20;
        else if (subscriberCount > 1000) channelScore += 16;
        else if (subscriberCount > 500) channelScore += 12;
        else if (subscriberCount > 100) channelScore += 8;
        else channelScore += 4;
        
        // 基于观看量/订阅者比率（最多30分）
        if (viewsPerSubscriber > 1000) channelScore += 30;
        else if (viewsPerSubscriber > 500) channelScore += 27;
        else if (viewsPerSubscriber > 200) channelScore += 24;
        else if (viewsPerSubscriber > 100) channelScore += 21;
        else if (viewsPerSubscriber > 50) channelScore += 18;
        else if (viewsPerSubscriber > 20) channelScore += 15;
        else if (viewsPerSubscriber > 10) channelScore += 12;
        else channelScore += 9;
        
        // 基于每月视频上传频率（最多30分）
        if (videosPerMonth > 20) channelScore += 30;
        else if (videosPerMonth > 15) channelScore += 27;
        else if (videosPerMonth > 10) channelScore += 24;
        else if (videosPerMonth > 8) channelScore += 21;
        else if (videosPerMonth > 6) channelScore += 18;
        else if (videosPerMonth > 4) channelScore += 15;
        else if (videosPerMonth > 2) channelScore += 12;
        else if (videosPerMonth > 1) channelScore += 9;
        else if (videosPerMonth > 0.5) channelScore += 6;
        else channelScore += 3;

        return {
            subscriberCount,
            viewCount,
            videoCount,
            viewsPerVideo: parseFloat(viewsPerVideo.toFixed(2)),
            subscribersPerVideo: parseFloat(subscribersPerVideo.toFixed(2)),
            viewsPerSubscriber: parseFloat(viewsPerSubscriber.toFixed(2)),
            daysSinceCreated,
            monthsSinceCreated,
            yearsSinceCreated,
            dailySubscriberGrowth: parseFloat(dailySubscriberGrowth.toFixed(2)),
            monthlySubscriberGrowth: parseFloat(monthlySubscriberGrowth.toFixed(2)),
            yearlySubscriberGrowth: parseFloat(yearlySubscriberGrowth.toFixed(2)),
            dailyViewGrowth: parseFloat(dailyViewGrowth.toFixed(2)),
            monthlyViewGrowth: parseFloat(monthlyViewGrowth.toFixed(2)),
            yearlyViewGrowth: parseFloat(yearlyViewGrowth.toFixed(2)),
            videosPerMonth: parseFloat(videosPerMonth.toFixed(2)),
            videosPerYear: parseFloat(videosPerYear.toFixed(2)),
            channelScore: Math.min(100, Math.round(channelScore))
        };
    }

    /**
     * 分析视频标签。
     * @param {Object} videoData - 视频数据对象
     * @returns {Object} - 包含标签分析的对象
     */
    analyzeVideoTags(videoData) {
        if (!videoData || !videoData.snippet || !videoData.snippet.tags || videoData.snippet.tags.length === 0) {
            return {
                error: "无标签数据",
                tagCount: 0,
                tags: [],
                mostFrequentWords: []
            };
        }

        const tags = videoData.snippet.tags;
        const tagCount = tags.length;
        
        // 分析标签中使用的单词频率
        const wordCounts = {};
        tags.forEach(tag => {
            // 分割标签并统计单词
            const words = tag.toLowerCase().split(/\s+/);
            words.forEach(word => {
                // 过滤掉太短的词
                if (word.length <= 2) return;
                
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
        });
        
        // 转换为数组并排序
        const wordFrequency = Object.entries(wordCounts)
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count);
        
        // 获取前10个最常用词
        const mostFrequentWords = wordFrequency.slice(0, 10);
        
        // 计算每个标签的长度
        const tagLengths = tags.map(tag => tag.length);
        const avgTagLength = tagLengths.reduce((sum, length) => sum + length, 0) / tagCount;
        
        // 分析标签数量的充分性（基于YouTube最佳实践）
        let tagQuantityAssessment = "";
        if (tagCount >= 15) {
            tagQuantityAssessment = "优秀 - 使用了充分的标签数量";
        } else if (tagCount >= 10) {
            tagQuantityAssessment = "良好 - 标签数量合理";
        } else if (tagCount >= 5) {
            tagQuantityAssessment = "一般 - 可以添加更多标签";
        } else {
            tagQuantityAssessment = "不足 - 标签数量太少，建议增加";
        }
        
        // 分析标签长度的合理性
        let tagLengthAssessment = "";
        if (avgTagLength > 20) {
            tagLengthAssessment = "标签平均长度较长，可能包含详细的关键词短语";
        } else if (avgTagLength > 10) {
            tagLengthAssessment = "标签平均长度适中，平衡了具体性和简洁性";
        } else {
            tagLengthAssessment = "标签平均长度较短，可能不够具体";
        }

        return {
            tagCount,
            tags,
            avgTagLength: parseFloat(avgTagLength.toFixed(2)),
            mostFrequentWords,
            tagQuantityAssessment,
            tagLengthAssessment,
            suggestions: this.generateTagSuggestions(tags, videoData.snippet.title, videoData.snippet.description)
        };
    }

    /**
     * 生成标签建议。
     * @param {string[]} existingTags - 现有标签
     * @param {string} title - 视频标题
     * @param {string} description - 视频描述
     * @returns {string[]} - 建议标签列表
     */
    generateTagSuggestions(existingTags, title, description) {
        // 从标题和描述中提取潜在关键词
        const existingTagsLower = existingTags.map(tag => tag.toLowerCase());
        const potentialKeywords = [];
        
        // 从标题中提取关键词
        if (title) {
            const titleWords = title.split(/\s+/).filter(word => word.length > 3);
            potentialKeywords.push(...titleWords);
        }
        
        // 从描述中提取关键词（取前几句话）
        if (description) {
            const firstFewSentences = description.split(/[.!?。！？]/).slice(0, 3).join('. ');
            const descWords = firstFewSentences.split(/\s+/).filter(word => word.length > 3);
            potentialKeywords.push(...descWords);
        }
        
        // 生成新的标签建议（不在现有标签中的关键词）
        const suggestions = potentialKeywords
            .filter(word => !existingTagsLower.some(tag => tag.includes(word.toLowerCase())))
            .filter((word, index, self) => self.indexOf(word) === index) // 去重
            .slice(0, 5); // 最多5个建议
            
        return suggestions;
    }

    /**
     * 评论情感分析。
     * @param {Object[]} comments - 评论数据数组
     * @returns {Object} - 包含情感分析结果的对象
     */
    async analyzeCommentSentiment(comments) {
        if (!comments || !Array.isArray(comments) || comments.length === 0) {
            return {
                error: "无评论数据",
                sentimentScore: 0,
                sentimentDistribution: {
                    positive: 0,
                    neutral: 0,
                    negative: 0
                },
                commentCount: 0
            };
        }

        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;
        
        // 分析每条评论的情感
        const analyzedComments = comments.map(comment => {
            if (!comment.text) return null;
            
            const text = comment.text.toLowerCase();
            let positiveScore = 0;
            let negativeScore = 0;
            
            // 检查积极词汇
            this.sentimentDictionary.positive.forEach(word => {
                if (text.includes(word.toLowerCase())) {
                    positiveScore += 1;
                }
            });
            
            // 检查消极词汇
            this.sentimentDictionary.negative.forEach(word => {
                if (text.includes(word.toLowerCase())) {
                    negativeScore += 1;
                }
            });
            
            // 确定整体情感
            let sentiment;
            if (positiveScore > negativeScore) {
                sentiment = 'positive';
                positiveCount++;
            } else if (negativeScore > positiveScore) {
                sentiment = 'negative';
                negativeCount++;
            } else {
                sentiment = 'neutral';
                neutralCount++;
            }
            
            return {
                ...comment,
                sentiment,
                positiveScore,
                negativeScore,
                overallScore: positiveScore - negativeScore
            };
        }).filter(Boolean);
        
        const commentCount = analyzedComments.length;
        
        // 计算整体情感分数（范围从-100到100）
        const totalPositive = positiveCount / commentCount * 100;
        const totalNegative = negativeCount / commentCount * 100;
        const sentimentScore = parseFloat((totalPositive - totalNegative).toFixed(2));
        
        // 情感分布百分比
        const sentimentDistribution = {
            positive: parseFloat((positiveCount / commentCount * 100).toFixed(2)),
            neutral: parseFloat((neutralCount / commentCount * 100).toFixed(2)),
            negative: parseFloat((negativeCount / commentCount * 100).toFixed(2))
        };
        
        // 排序评论（最积极和最消极）
        const mostPositiveComments = [...analyzedComments]
            .sort((a, b) => b.overallScore - a.overallScore)
            .slice(0, 3);
            
        const mostNegativeComments = [...analyzedComments]
            .sort((a, b) => a.overallScore - b.overallScore)
            .slice(0, 3);
        
        return {
            sentimentScore,
            sentimentDistribution,
            commentCount,
            mostPositiveComments,
            mostNegativeComments,
            sentimentAssessment: this.getSentimentAssessment(sentimentScore)
        };
    }

    /**
     * 获取情感评估描述。
     * @param {number} score - 情感分数 (-100 到 100)
     * @returns {string} - 情感评估描述
     */
    getSentimentAssessment(score) {
        if (score >= 80) return "极其积极 - 观众反应非常热烈";
        if (score >= 60) return "非常积极 - 观众反应热情";
        if (score >= 40) return "相当积极 - 观众普遍喜欢";
        if (score >= 20) return "较为积极 - 观众反应良好";
        if (score >= 10) return "略微积极 - 观众稍有好感";
        if (score > -10) return "中性 - 观众反应平淡";
        if (score > -20) return "略微消极 - 观众略有不满";
        if (score > -40) return "较为消极 - 观众有明显不满";
        if (score > -60) return "相当消极 - 观众普遍不满";
        if (score > -80) return "非常消极 - 观众反应强烈不满";
        return "极其消极 - 观众反应极度负面";
    }

    /**
     * 分析视频标题效果。
     * @param {string} title - 视频标题
     * @returns {Object} - 包含标题分析的对象
     */
    analyzeTitleEffectiveness(title) {
        if (!title) {
            return {
                error: "无标题数据"
            };
        }
        
        const length = title.length;
        const wordCount = title.split(/\s+/).length;
        
        // 标题长度评估
        let lengthAssessment = "";
        if (length > 100) {
            lengthAssessment = "过长 - YouTube搜索结果中可能会被截断";
        } else if (length > 70) {
            lengthAssessment = "较长 - 在某些界面可能显示不完整";
        } else if (length > 40) {
            lengthAssessment = "适中 - 长度合理";
        } else if (length > 20) {
            lengthAssessment = "较短 - 可以适当增加信息量";
        } else {
            lengthAssessment = "过短 - 可能缺乏足够的关键词";
        }
        
        // 检查是否包含常见的吸引注意力的词汇
        const attentionWords = [
            '最', '最好', '必看', '秘密', '惊人', '震撼', '爆款', '神器', '史上',
            'best', 'amazing', 'shocking', 'secret', 'ultimate', 'perfect', 'must see'
        ];
        
        const containsAttentionWord = attentionWords.some(word => 
            title.toLowerCase().includes(word.toLowerCase())
        );
        
        // 检查是否包含数字（如排名、清单）
        const containsNumbers = /\d/.test(title);
        
        // 检查是否使用了问号（提问式标题）
        const containsQuestion = title.includes('?') || title.includes('？');
        
        // 计算标题效果分数（满分100）
        let titleScore = 0;
        
        // 基于长度（最多30分）
        if (length >= 40 && length <= 70) titleScore += 30;
        else if (length > 30 && length < 40) titleScore += 25;
        else if (length > 70 && length <= 100) titleScore += 20;
        else if (length > 20 && length <= 30) titleScore += 15;
        else titleScore += 10;
        
        // 基于吸引注意力的词汇（最多20分）
        if (containsAttentionWord) titleScore += 20;
        
        // 基于数字的使用（最多20分）
        if (containsNumbers) titleScore += 20;
        
        // 基于问句的使用（最多15分）
        if (containsQuestion) titleScore += 15;
        
        // 基于字数（最多15分）
        if (wordCount >= 6 && wordCount <= 12) titleScore += 15;
        else if (wordCount > 4 && wordCount < 6) titleScore += 12;
        else if (wordCount > 12 && wordCount <= 15) titleScore += 10;
        else titleScore += 5;
        
        return {
            length,
            wordCount,
            lengthAssessment,
            containsAttentionWord,
            containsNumbers,
            containsQuestion,
            titleScore: Math.min(100, titleScore),
            suggestions: this.generateTitleSuggestions(title)
        };
    }

    /**
     * 生成标题优化建议。
     * @param {string} title - 视频标题
     * @returns {string[]} - 标题优化建议
     */
    generateTitleSuggestions(title) {
        const suggestions = [];
        const wordCount = title.split(/\s+/).length;
        const length = title.length;
        
        // 长度建议
        if (length < 30) {
            suggestions.push("标题较短，可以添加更多关键词以提高搜索发现率");
        } else if (length > 100) {
            suggestions.push("标题过长，可能在搜索结果中被截断，建议精简");
        }
        
        // 关键词建议
        if (!(/\d/.test(title))) {
            suggestions.push("考虑在标题中添加数字，如'5种方法'、'2023年最新'等");
        }
        
        // 提问式标题建议
        if (!(title.includes('?') || title.includes('？'))) {
            suggestions.push("考虑使用提问式标题，如'如何...?'、'为什么...?'等，以增加点击率");
        }
        
        // 标题长度建议
        if (wordCount < 5) {
            suggestions.push("标题词数较少，可以适当扩展以包含更多关键词");
        } else if (wordCount > 15) {
            suggestions.push("标题词数较多，可以考虑精简以增强可读性");
        }
        
        // 如果没有发现问题，给出肯定评价
        if (suggestions.length === 0) {
            suggestions.push("标题长度和结构良好，无明显改进建议");
        }
        
        return suggestions;
    }

    /**
     * 分析视频描述有效性。
     * @param {string} description - 视频描述
     * @returns {Object} - 包含描述分析的对象
     */
    analyzeDescriptionEffectiveness(description) {
        if (!description) {
            return {
                error: "无描述数据",
                length: 0,
                recommendedLength: "1000-2000字符",
                containsLinks: false,
                containsTimestamps: false,
                descriptionScore: 0
            };
        }
        
        const length = description.length;
        const paragraphCount = description.split('\n\n').length;
        
        // 检查是否包含链接
        const containsLinks = /https?:\/\/[^\s]+/.test(description);
        
        // 检查是否包含时间戳（例如 00:45, 1:23, 01:23:45 等格式）
        const containsTimestamps = /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(description);
        
        // 检查是否包含相关关键词/主题标签
        const containsHashtags = /#[a-zA-Z0-9_\u4e00-\u9fa5]+/.test(description);
        
        // 检查是否包含行动号召（如订阅、点赞、评论等）
        const ctaWords = [
            '订阅', '点赞', '关注', '评论', '分享', '加入', '通知', '打开', '开启',
            'subscribe', 'like', 'follow', 'comment', 'share', 'join', 'notification', 'bell'
        ];
        
        const containsCTA = ctaWords.some(word => 
            description.toLowerCase().includes(word.toLowerCase())
        );
        
        // 计算描述效果分数（满分100）
        let descriptionScore = 0;
        
        // 基于长度（最多40分）
        if (length >= 1000 && length <= 2000) descriptionScore += 40;
        else if (length >= 500 && length < 1000) descriptionScore += 35;
        else if (length > 2000 && length <= 3000) descriptionScore += 30;
        else if (length >= 200 && length < 500) descriptionScore += 25;
        else if (length > 3000) descriptionScore += 20;
        else descriptionScore += 10;
        
        // 基于链接（最多15分）
        if (containsLinks) descriptionScore += 15;
        
        // 基于时间戳（最多15分）
        if (containsTimestamps) descriptionScore += 15;
        
        // 基于主题标签（最多15分）
        if (containsHashtags) descriptionScore += 15;
        
        // 基于行动号召（最多15分）
        if (containsCTA) descriptionScore += 15;
        
        // 长度评估
        let lengthAssessment = "";
        if (length > 3000) {
            lengthAssessment = "过长 - 内容可能冗余";
        } else if (length >= 1000 && length <= 2000) {
            lengthAssessment = "理想 - 长度合适，有充分的SEO价值";
        } else if (length >= 500 && length < 1000) {
            lengthAssessment = "适中 - 长度合理";
        } else if (length >= 200 && length < 500) {
            lengthAssessment = "较短 - 可以添加更多内容";
        } else {
            lengthAssessment = "过短 - 建议大幅增加内容和关键词";
        }
        
        return {
            length,
            paragraphCount,
            lengthAssessment,
            recommendedLength: "1000-2000字符",
            containsLinks,
            containsTimestamps,
            containsHashtags,
            containsCTA,
            descriptionScore: Math.min(100, descriptionScore),
            suggestions: this.generateDescriptionSuggestions(description, length, containsLinks, containsTimestamps, containsCTA)
        };
    }

    /**
     * 生成描述优化建议。
     * @param {string} description - 视频描述
     * @param {number} length - 描述长度
     * @param {boolean} containsLinks - 是否包含链接
     * @param {boolean} containsTimestamps - 是否包含时间戳
     * @param {boolean} containsCTA - 是否包含行动号召
     * @returns {string[]} - 描述优化建议
     */
    generateDescriptionSuggestions(description, length, containsLinks, containsTimestamps, containsCTA) {
        const suggestions = [];
        
        // 长度建议
        if (length < 500) {
            suggestions.push("描述太短，建议扩展至少1000字符以提高SEO效果");
        } else if (length > 3000) {
            suggestions.push("描述可能过长，考虑精简并突出重点内容");
        }
        
        // 链接建议
        if (!containsLinks) {
            suggestions.push("建议添加相关链接，如社交媒体、网站或相关视频");
        }
        
        // 时间戳建议
        if (!containsTimestamps) {
            suggestions.push("添加时间戳可以帮助观众快速导航到感兴趣的部分");
        }
        
        // 行动号召建议
        if (!containsCTA) {
            suggestions.push("添加明确的行动号召，如'点赞订阅'、'开启通知'等");
        }
        
        // 段落格式建议
        if (description.split('\n\n').length < 3 && length > 500) {
            suggestions.push("建议使用多个段落和空行来提高可读性");
        }
        
        // 如果没有发现问题，给出肯定评价
        if (suggestions.length === 0) {
            suggestions.push("描述内容全面且结构良好，无明显改进建议");
        }
        
        return suggestions;
    }

    /**
     * 获取评论数据（先从API获取）。
     * @param {string} videoId - 视频ID
     * @param {number} maxResults - 最大返回结果数量
     * @returns {Promise<Object[]>} - 评论数据
     */
    async getVideoComments(videoId, maxResults = 20) {
        try {
            return await youTubeApiClient.getVideoComments(videoId, maxResults);
        } catch (error) {
            console.error("Data Processor: Error fetching comments:", error);
            return [];
        }
    }
}

// 导出单例实例
const dataProcessor = new DataProcessor();
export default dataProcessor;