# Dos masas forzadas

Pagina estatica para simular el problema del enunciado:

```text
m1 x1'' + k(x1 - x2) = F0 cos(wt)
m2 x2'' + k(x2 - x1) = 0
```

La frecuencia natural usada por la simulacion es:

```text
wn = sqrt(k(m1 + m2) / (m1 m2))
```

Los valores iniciales son los del problema:

```text
k = 75 N/m
m1 = 2 kg
m2 = 3 kg
F0 = 10 N
```

La pagina muestra la animacion de ambas masas, la evolucion temporal de `x1` y `x2`, y la dependencia de las amplitudes estacionarias `|X1p|` y `|X2p|` respecto de la frecuencia `w`. El boton `w = wn` lleva el sistema a la resonancia.

Con las condiciones iniciales del problema, las constantes de la solucion general quedan:

```text
C1 = 0
B1 = 0
```

Por eso la solucion que se muestra en la pagina queda escrita como:

```text
x1(t) = C2 + A cos(wn t) + X1 cos(wt)
x2(t) = C2 - (m1/m2) A cos(wn t) + X2 cos(wt)
```

## Como usarlo en GitHub Pages

1. Crear un repositorio en GitHub.
2. Subir `index.html`, `styles.css` y `script.js` a la raiz del repositorio.
3. Entrar a `Settings > Pages`.
4. En `Build and deployment`, elegir `Deploy from a branch`.
5. Seleccionar la rama principal y la carpeta `/root`.
