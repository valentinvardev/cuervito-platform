#!/usr/bin/env bash
# Crea o actualiza la Lambda de derivados. Pensado para AWS CloudShell, en la
# región del bucket: ya tiene la AWS CLI con tus permisos, Node y zip, y es
# Linux x86_64 como la Lambda.
#
#   BUCKET=el-bucket CLAVE_VPS=AKIA... bash desplegar.sh
#
# BUCKET     el bucket de las fotos (obligatorio).
# CLAVE_VPS  el access key ID que usa la app en el VPS (AWS_ACCESS_KEY_ID del
#            .env; el ID, no el secreto). Con él se busca el usuario de IAM y
#            se le da permiso para invocar la función. Opcional: sin él, el
#            script imprime la política para agregarla a mano.
# FUNCION    nombre de la función (por defecto cuervito-derivados).
# PREFIJO    prefijo de las claves en el bucket (por defecto cuervito).
# MEMORIA    MB de la Lambda (por defecto 3008: casi dos núcleos).
set -euo pipefail

BUCKET="${BUCKET:?Definí BUCKET, el bucket de las fotos}"
FUNCION="${FUNCION:-cuervito-derivados}"
PREFIJO="${PREFIJO:-cuervito}"
MEMORIA="${MEMORIA:-3008}"
ROL="${FUNCION}-rol"

cd "$(dirname "$0")"

# La región sale del bucket, no de la consola: la función tiene que estar al
# lado de las fotos, y el VPS la busca en la región de su AWS_REGION.
REGION="$(aws s3api get-bucket-location --bucket "$BUCKET" --query LocationConstraint --output text)"
case "$REGION" in None|null|"") REGION=us-east-1 ;; EU) REGION=eu-west-1 ;; esac
echo "Región del bucket: $REGION"
if [ -n "${AWS_REGION:-}" ] && [ "$AWS_REGION" != "$REGION" ]; then
  echo "   (CloudShell está en $AWS_REGION; la función se crea igual en $REGION)"
fi

echo "== 1/4 Armando el paquete"
npm ci --no-audit --no-fund
node construir.mjs --zip

echo "== 2/4 Rol de la función: sólo leer originales y escribir derivados"
if ! aws iam get-role --role-name "$ROL" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROL" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
  }' >/dev/null
  echo "   rol creado; esperando que IAM lo propague"
  sleep 12
fi
# Afuera del if: si se cortó la primera vez, correrlo de nuevo lo repara.
aws iam attach-role-policy --role-name "$ROL" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name "$ROL" --policy-name s3-derivados --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    { \"Effect\": \"Allow\", \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${BUCKET}/${PREFIJO}/users/*/events/*/original/*\" },
    { \"Effect\": \"Allow\", \"Action\": [\"s3:PutObject\", \"s3:DeleteObject\"],
      \"Resource\": [
        \"arn:aws:s3:::${BUCKET}/${PREFIJO}/users/*/events/*/preview/*\",
        \"arn:aws:s3:::${BUCKET}/${PREFIJO}/users/*/events/*/preview-clean/*\",
        \"arn:aws:s3:::${BUCKET}/cuervito/users/*/events/*/thumb/*\"
      ] }
  ]
}"
ROL_ARN="$(aws iam get-role --role-name "$ROL" --query Role.Arn --output text)"

echo "== 3/4 La función"
if aws lambda get-function --function-name "$FUNCION" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCION" --region "$REGION" \
    --zip-file fileb://funcion.zip >/dev/null
  aws lambda wait function-updated --function-name "$FUNCION" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FUNCION" --region "$REGION" \
    --memory-size "$MEMORIA" --timeout 60 >/dev/null
  echo "   actualizada"
else
  # IAM tarda en propagar un rol nuevo, sin un tiempo garantizado: mientras
  # tanto Lambda contesta que no lo puede asumir. Se reintenta un rato.
  for intento in 1 2 3 4 5 6 7 8; do
    if salida="$(aws lambda create-function --function-name "$FUNCION" --region "$REGION" \
      --runtime nodejs22.x --architectures x86_64 --handler handler.handler \
      --role "$ROL_ARN" --zip-file fileb://funcion.zip \
      --memory-size "$MEMORIA" --timeout 60 2>&1)"; then
      echo "   creada"
      break
    fi
    if echo "$salida" | grep -q "cannot be assumed" && [ "$intento" -lt 8 ]; then
      echo "   el rol todavía no se propagó, reintento en 10 s"
      sleep 10
    else
      echo "$salida" >&2
      exit 1
    fi
  done
fi
aws lambda wait function-active-v2 --function-name "$FUNCION" --region "$REGION"
FUNCION_ARN="$(aws lambda get-function --function-name "$FUNCION" --region "$REGION" --query Configuration.FunctionArn --output text)"

echo "== 4/4 Permiso para que el VPS la invoque"
POLITICA="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"${FUNCION_ARN}\"}]}"
if [ -n "${CLAVE_VPS:-}" ]; then
  USUARIO="$(aws iam get-access-key-last-used --access-key-id "$CLAVE_VPS" --query UserName --output text)"
  aws iam put-user-policy --user-name "$USUARIO" --policy-name invocar-derivados --policy-document "$POLITICA"
  echo "   listo: el usuario ${USUARIO} puede invocarla"
else
  echo "   Agregale al usuario de IAM del VPS esta política:"
  echo "   $POLITICA"
fi

echo "== Prueba: invocarla con un pedido vacío"
# Tiene que contestar "faltan campos": prueba que el paquete carga, sharp para
# Linux incluido, antes de que la use una foto de verdad.
aws lambda invoke --function-name "$FUNCION" --region "$REGION" \
  --cli-binary-format raw-in-base64-out --payload '{}' /tmp/derivados-prueba.json >/dev/null
if grep -q '"faltan campos"' /tmp/derivados-prueba.json; then
  echo "   contesta bien"
else
  echo "   NO contestó lo esperado:" >&2
  cat /tmp/derivados-prueba.json >&2
  exit 1
fi

LIMITE="$(aws lambda get-account-settings --region "$REGION" --query AccountLimit.ConcurrentExecutions --output text 2>/dev/null || true)"
if [[ "$LIMITE" =~ ^[0-9]+$ ]]; then
  # La mitad del límite de la cuenta, que comparten otras funciones, y no más de 8.
  SUGERIDO=$(( LIMITE / 2 )); [ "$SUGERIDO" -gt 8 ] && SUGERIDO=8; [ "$SUGERIDO" -lt 1 ] && SUGERIDO=1
else
  LIMITE="desconocido"
  SUGERIDO=4
fi
echo
echo "Hecho."
echo "  Función: ${FUNCION_ARN}"
echo "  Lambdas simultáneas que permite la cuenta: ${LIMITE}"
echo
echo "En el .env de la app en el VPS (y después pm2 restart cuervito):"
echo "  PROCESADOR_LAMBDA=${FUNCION}"
echo "  PROCESADOR_LAMBDA_A_LA_VEZ=${SUGERIDO}"
echo "  AWS_REGION=${REGION}   (ya debería estar así)"
