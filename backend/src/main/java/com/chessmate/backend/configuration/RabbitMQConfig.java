package com.chessmate.backend.configuration;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.support.converter.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE = "analysis.queue";
    public static final String TASK_QUEUE = "etl.tasks";
    public static final String RESULT_QUEUE = "etl.queue";
    public static final String EXCHANGE = "analysis.exchange";
    public static final String ROUTING_KEY = "analysis.routingKey";

    // ========================
    // QUEUE / EXCHANGE
    // ========================

    @Bean
    public Queue analysisQueue() {
        return new Queue(QUEUE, true);
    }

    @Bean public Queue taskQueue() { return new Queue(TASK_QUEUE); }
    @Bean public Queue resultQueue() { return new Queue(RESULT_QUEUE); }

    @Bean
    public DirectExchange analysisExchange() {
        return new DirectExchange(EXCHANGE);
    }

    @Bean
    public Binding binding(Queue analysisQueue, DirectExchange analysisExchange) {
        return BindingBuilder.bind(analysisQueue)
                .to(analysisExchange)
                .with(ROUTING_KEY);
    }

    // ========================
    // MESSAGE CONVERTER
    // ========================

    @Bean(name = "rabbitMessageConverter")
    public MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();

        DefaultJackson2JavaTypeMapper mapper = new DefaultJackson2JavaTypeMapper();
        mapper.setTrustedPackages("com.chessmate.backend.job");

        converter.setJavaTypeMapper(mapper);
        return converter;
    }

    // ========================
    // RABBIT TEMPLATE (producer)
    // ========================

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory cf,
                                        @Qualifier("rabbitMessageConverter") MessageConverter mc) {
        RabbitTemplate template = new RabbitTemplate(cf);
        template.setMessageConverter(mc);
        return template;
    }

    // ========================
    // LISTENER (worker)
    // ========================

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter messageConverter) {

        SimpleRabbitListenerContainerFactory factory =
                new SimpleRabbitListenerContainerFactory();

        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);

        // 🔥 workers parallèles
        factory.setConcurrentConsumers(4);
        factory.setMaxConcurrentConsumers(8);

        // 🔥 évite flood mémoire
        factory.setPrefetchCount(10);

        return factory;
    }
}