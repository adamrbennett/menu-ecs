node {
  // checkout from scm into our workspace
  checkout scm

  stage('Deploy') {
    def service = "menu"
    def serviceName = "${service}-${VERSION}"

    // check if the service exists
    def serviceExists = sh script: "aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${serviceName} | jq -je '.services | .[0] | select(.status == \"ACTIVE\") | .serviceArn'", returnStatus: true

    // check if the log group exists
    def logGroupExists = sh script: "aws logs describe-log-groups | jq -e '.logGroups | .[] | select(.logGroupName == \"/${RESOURCE_PREFIX}/${serviceName}\")'", returnStatus: true

    // the container definitions
    def containerDefinitions = """
      [
        {
          "cpu": 128,
          "environment": [
            {
              "name": "APP_PORT",
              "value": "80"
            },
            {
              "name": "ROUTES_SSM_KEY",
              "value": "${RESOURCE_PREFIX}-routes"
            }
          ],
          "portMappings": [
            {
              "hostPort": 0,
              "containerPort": 80,
              "protocol": "tcp"
            }
          ],
          "logConfiguration": {
            "logDriver": "awslogs",
            "options": {
              "awslogs-group": "/${RESOURCE_PREFIX}/${serviceName}",
              "awslogs-region": "us-east-1"
            }
          },
          "essential": true,
          "image": "${DOCKER_IMAGE}",
          "memory": 128,
          "memoryReservation": 64,
          "name": "${service}"
        }
      ]
    """.replaceAll("\\s", "")

    // create the log group, if necessary
    if (logGroupExists != 0) {
      sh "aws logs create-log-group --log-group-name /${RESOURCE_PREFIX}/${serviceName}"
    }

    // create a new task definition
    def taskRevision = sh script: "aws ecs register-task-definition --family ${service} --container-definitions '${containerDefinitions}' | jq -j '.taskDefinition.revision'", returnStdout: true

    if (serviceExists == 0) {
      print "Service ${serviceName} already exists, updating"

      // update the service to use the new task definition
      sh "aws ecs update-service --cluster ${ECS_CLUSTER} --service ${serviceName} --task-definition ${service}:${taskRevision}"
    } else {
      print "Creating new service: ${serviceName}"

      // create the target group
      def targetGroupArn = sh script: "aws elbv2 create-target-group --name ${RESOURCE_PREFIX}-ecs-${serviceName} --protocol HTTP --port 80 --vpc-id ${VPC_ID} | jq -j '.TargetGroups | .[0] | .TargetGroupArn'", returnStdout: true

      // update the target group attributes
      sh "aws elbv2 modify-target-group-attributes --target-group-arn ${targetGroupArn} --attributes Key=deregistration_delay.timeout_seconds,Value=60"

      // determine the new priority (max existing + 1)
      def maxPriority = sh script: "aws elbv2 describe-rules --listener-arn ${ALB_LISTENER_ARN} | jq -j '.Rules | sort_by(.Priority) | .[0:-1] | max_by(.Priority) | .Priority'", returnStdout: true
      def priority = 100
      if (maxPriority.isNumber())
        priority = (maxPriority as Integer) + 1

      // create the ALB listener rule
      sh "aws elbv2 create-rule --listener-arn ${ALB_LISTENER_ARN} --conditions Field=host-header,Values=${serviceName}.${DOMAIN} --priority ${priority} --actions Type=forward,TargetGroupArn=${targetGroupArn}"

      // create the new service
      sh "aws ecs create-service --cluster ${ECS_CLUSTER} --service-name ${serviceName} --task-definition ${service}:${taskRevision} --desired-count ${DESIRED_COUNT} --role ${ECS_SERVICE_ROLE_ARN} --load-balancers targetGroupArn=${targetGroupArn},containerName=${service},containerPort=80"
    }
  }
}
