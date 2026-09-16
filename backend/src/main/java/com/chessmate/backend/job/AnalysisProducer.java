package com.chessmate.backend.job;

import com.chessmate.backend.configuration.RabbitMQConfig;

import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class AnalysisProducer {

    private final RabbitTemplate rabbitTemplate;

    public AnalysisProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void sendAnalysisJob(Long partieId, Long joueurId) {
        AnalysisJob job = new AnalysisJob(partieId, joueurId);
        try {
            rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.ROUTING_KEY,
                job
            );
            System.out.println("Message envoyé pour la partie: " + partieId);
        } catch (AmqpException e) {
            System.out.println("⚠️ RabbitMQ indisponible, job ignoré pour partie " + partieId);
        }
    }
}