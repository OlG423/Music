// ===== DETECTAR DISPOSITIVO =====
function esMovil() {
    return window.matchMedia('(max-width: 600px)').matches;
}

// ===== ELEMENTOS DE LA TARJETA =====
const tarjeta = document.getElementById('tarjetaMovible');
const asa = document.getElementById('asa');

let arrastrando = false;
let desplazamientoX = 0;
let desplazamientoY = 0;

let redimensionando = false;
let inicioX = 0;
let anchoInicial = 0;

const ANCHO_MINIMO = 260;

// ===== ARRASTRAR LA TARJETA =====
tarjeta.addEventListener('pointerdown', (e) => {
    // No arrastrar desde los controles ni en pantallas móviles.
    if (
        esMovil() ||
        e.target.closest('button, input, label, .asa-redimensionar')
    ) {
        return;
    }

    const rect = tarjeta.getBoundingClientRect();

    tarjeta.style.transform = 'none';
    tarjeta.style.left = rect.left + 'px';
    tarjeta.style.top = rect.top + 'px';

    desplazamientoX = e.clientX - rect.left;
    desplazamientoY = e.clientY - rect.top;

    arrastrando = true;
    tarjeta.setPointerCapture(e.pointerId);
});

tarjeta.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;

    let x = e.clientX - desplazamientoX;
    let y = e.clientY - desplazamientoY;

    const maxX = window.innerWidth - tarjeta.offsetWidth;
    const maxY = window.innerHeight - tarjeta.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    tarjeta.style.left = x + 'px';
    tarjeta.style.top = y + 'px';
});

function terminarArrastre() {
    arrastrando = false;
}

tarjeta.addEventListener('pointerup', terminarArrastre);
tarjeta.addEventListener('pointercancel', terminarArrastre);

// ===== REDIMENSIONAR LA TARJETA =====
asa.addEventListener('pointerdown', (e) => {
    e.stopPropagation();

    if (esMovil()) return;

    const rect = tarjeta.getBoundingClientRect();

    // Fijar la posición actual de la tarjeta.
    tarjeta.style.transform = 'none';
    tarjeta.style.left = rect.left + 'px';
    tarjeta.style.top = rect.top + 'px';
    tarjeta.style.width = rect.width + 'px';

    redimensionando = true;
    inicioX = e.clientX;
    anchoInicial = rect.width;

    asa.setPointerCapture(e.pointerId);
});

asa.addEventListener('pointermove', (e) => {
    if (!redimensionando) return;

    const izquierda = parseFloat(tarjeta.style.left) || 0;
    const maximo = Math.max(
        ANCHO_MINIMO,
        window.innerWidth - izquierda - 8
    );

    const nuevo = anchoInicial + (e.clientX - inicioX);
    const ancho = Math.max(
        ANCHO_MINIMO,
        Math.min(nuevo, maximo)
    );

    tarjeta.style.width = ancho + 'px';
});

function terminarRedimension() {
    redimensionando = false;
}

asa.addEventListener('pointerup', terminarRedimension);
asa.addEventListener('pointercancel', terminarRedimension);

// ===== ELEMENTOS DEL REPRODUCTOR =====
const audio = document.getElementById('audio');
const btnReproducir = document.getElementById('reproducir');
const btnAnterior = document.getElementById('anterior');
const btnSiguiente = document.getElementById('siguiente');
const btnAleatorio = document.getElementById('aleatorio');

const barraProgreso = document.getElementById('progreso');
const selectorArchivos = document.getElementById('selectorArchivos');

const titulo = document.getElementById('titulo');
const artista = document.getElementById('artista');
const pista = document.getElementById('pista');
const album = document.getElementById('album');

const imgPortada = document.getElementById('portada');
const tiempoActual = document.getElementById('tiempoActual');
const tiempoRestante = document.getElementById('tiempoRestante');

let playlist = [];
let indiceActual = 0;
let aleatorio = false;
let orden = [];

// ===== REPRODUCIR AUDIO =====
function reproducirAudio() {
    audio.play().catch(() => {
        // El navegador puede bloquear la reproducción.
    });
}

// ===== CREAR ORDEN DE REPRODUCCIÓN =====
function construirOrden() {
    const indices = playlist.map((_, i) => i);

    if (!aleatorio) {
        orden = indices;
        return;
    }

    // Mantener la canción actual al principio.
    const resto = indices.filter(i => i !== indiceActual);

    // Mezcla Fisher-Yates.
    for (let i = resto.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [resto[i], resto[j]] = [resto[j], resto[i]];
    }

    orden = playlist.length > 0
        ? [indiceActual, ...resto]
        : [];
}

// ===== CAMBIAR DE CANCIÓN =====
function irA(indice) {
    if (indice < 0 || indice >= playlist.length) return;

    indiceActual = indice;
    cargarCancion(indice);
    reproducirAudio();
}

// ===== LIMPIAR NOMBRES =====
function limpiarTexto(texto) {
    return texto
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(
            /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|mx|es|io|me|info|fm|co)\b\S*/gi,
            ' '
        )
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s\-–—.]+|[\s\-–—.]+$/g, '')
        .trim();
}

// ===== ANALIZAR NOMBRE DEL ARCHIVO =====
// Formato esperado: Artista - Canción
function analizarNombre(nombreArchivo) {
    const sinExt = nombreArchivo.replace(/\.[^/.]+$/, '');

    const sinNumero = sinExt.replace(
        /^\d{1,3}\s*[-._)]\s*/,
        ''
    );

    const limpio = limpiarTexto(sinNumero) || sinExt;
    const partes = limpio.split(' - ');

    if (partes.length >= 2) {
        return {
            artista: partes[0].trim(),
            titulo: partes.slice(1).join(' - ').trim()
        };
    }

    return {
        artista: '',
        titulo: limpio
    };
}

// ===== LEER TAMAÑOS ID3 =====
function tamanoSincronizado(b, o) {
    return (
        ((b[o] & 0x7f) << 21) |
        ((b[o + 1] & 0x7f) << 14) |
        ((b[o + 2] & 0x7f) << 7) |
        (b[o + 3] & 0x7f)
    );
}

function tamanoNormal(b, o) {
    return (
        (
            (b[o] << 24) |
            (b[o + 1] << 16) |
            (b[o + 2] << 8) |
            b[o + 3]
        ) >>> 0
    );
}

// ===== LEER TEXTO ID3 =====
function leerTexto(datos, inicio, final) {
    if (final <= inicio + 1) return null;

    // Codificaciones ID3: 0 = Latin-1, 1 = UTF-16,
    // 2 = UTF-16BE, 3 = UTF-8.
    const codificaciones = [
        'windows-1252',
        'utf-16',
        'utf-16be',
        'utf-8'
    ];

    const nombre = codificaciones[datos[inicio]] || 'utf-8';

    try {
        const texto = new TextDecoder(nombre).decode(
            datos.subarray(inicio + 1, final)
        );

        return limpiarTexto(texto.replace(/\0/g, '')) || null;
    } catch (error) {
        return null;
    }
}

// ===== LEER PORTADA ID3 =====
function leerAPIC(datos, inicio, final) {
    if (inicio >= final) return null;

    const codificacion = datos[inicio];
    let p = inicio + 1;

    // MIME terminado en cero.
    const finMime = datos.indexOf(0, p);

    if (finMime === -1 || finMime >= final) return null;

    const mime = String.fromCharCode(
        ...datos.slice(p, finMime)
    );

    p = finMime + 1;

    // Saltar el tipo de imagen.
    p += 1;

    // Buscar el final de la descripción.
    if (codificacion === 1 || codificacion === 2) {
        let i = p;

        while (
            i + 1 < final &&
            (datos[i] !== 0 || datos[i + 1] !== 0)
        ) {
            i += 2;
        }

        p = i + 2;
    } else {
        const finDesc = datos.indexOf(0, p);

        if (finDesc === -1 || finDesc >= final) return null;

        p = finDesc + 1;
    }

    if (p >= final) return null;

    const tipoImagen = mime && mime !== '-->'
        ? mime
        : 'image/jpeg';

    return new Blob(
        [datos.slice(p, final)],
        { type: tipoImagen }
    );
}

// ===== LEER ETIQUETAS ID3 =====
async function leerID3(archivo) {
    const vacio = {
        portada: null,
        titulo: null,
        artista: null,
        album: null
    };

    try {
        const cabecera = new Uint8Array(
            await archivo.slice(0, 10).arrayBuffer()
        );

        // Comprobar que el archivo tenga etiquetas ID3.
        if (
            cabecera[0] !== 0x49 ||
            cabecera[1] !== 0x44 ||
            cabecera[2] !== 0x33
        ) {
            return vacio;
        }

        const version = cabecera[3];
        const tamanoTag = tamanoSincronizado(cabecera, 6) + 10;

        const datos = new Uint8Array(
            await archivo.slice(0, tamanoTag).arrayBuffer()
        );

        const fin = Math.min(tamanoTag, datos.length);
        const resultado = { ...vacio };

        let pos = 10;

        // Saltar la cabecera extendida si existe.
        if (version >= 3 && (cabecera[5] & 0x40)) {
            const tamanoExt = version === 4
                ? tamanoSincronizado(datos, 10)
                : tamanoNormal(datos, 10);

            pos += tamanoExt + (version === 4 ? 0 : 4);
        }

        while (pos + 10 <= fin) {
            if (datos[pos] === 0) break;

            const id = String.fromCharCode(
                datos[pos],
                datos[pos + 1],
                datos[pos + 2],
                datos[pos + 3]
            );

            const tamanoFrame = version === 4
                ? tamanoSincronizado(datos, pos + 4)
                : tamanoNormal(datos, pos + 4);

            const inicio = pos + 10;
            const final = Math.min(inicio + tamanoFrame, fin);

            if (final < inicio) break;

            if (id === 'APIC' && !resultado.portada) {
                resultado.portada = leerAPIC(
                    datos,
                    inicio,
                    final
                );
            } else if (id === 'TIT2' && !resultado.titulo) {
                resultado.titulo = leerTexto(
                    datos,
                    inicio,
                    final
                );
            } else if (id === 'TPE1' && !resultado.artista) {
                resultado.artista = leerTexto(
                    datos,
                    inicio,
                    final
                );
            } else if (id === 'TALB' && !resultado.album) {
                resultado.album = leerTexto(
                    datos,
                    inicio,
                    final
                );
            }

            // Evitar un bucle si el tamaño del frame no es válido.
            if (tamanoFrame === 0) break;

            pos = inicio + tamanoFrame;
        }

        return resultado;
    } catch (error) {
        return vacio;
    }
}

// ===== OBTENER INFORMACIÓN DE LA CANCIÓN =====
function obtenerInfo(cancion) {
    if (!cancion.infoPromesa) {
        cancion.infoPromesa = leerID3(cancion.archivo)
            .then(tags => {
                if (tags.portada) {
                    cancion.portadaUrl = URL.createObjectURL(
                        tags.portada
                    );
                }

                return {
                    portada: cancion.portadaUrl || null,
                    titulo: tags.titulo || cancion.analisis.titulo,
                    artista: tags.artista || cancion.analisis.artista,
                    album: tags.album || null
                };
            });
    }

    return cancion.infoPromesa;
}

// ===== MOSTRAR INFORMACIÓN DE LA CANCIÓN =====
async function mostrarInfo(cancion) {
    const info = await obtenerInfo(cancion);
    pintarItem(playlist.indexOf(cancion), info.titulo, info.artista);
    guardarAlbumEnFila(playlist.indexOf(cancion), info.album);
    // No actualizar la interfaz si el usuario cambió de canción.
    if (playlist[indiceActual] !== cancion) return;

    titulo.textContent = info.titulo || cancion.analisis.titulo;
    artista.textContent = info.artista || 'Artista desconocido';
    album.textContent = info.album || '';
    actualizarMediaSession(info);

    if (info.portada) {
        imgPortada.src = info.portada;
        imgPortada.hidden = false;

        extraerColores(info.portada).then(colores => {
            if (playlist[indiceActual] === cancion) {
                aplicarTema(colores);
            }
        });
    } else {
        imgPortada.removeAttribute('src');
        imgPortada.hidden = true;
        aplicarTema(null);
    }
}

// ===== CARGAR ARCHIVOS =====
// ===== BIBLIOTECA GUARDADA (INDEXEDDB) =====
const NOMBRE_DB = 'reproductor-db';
const TIENDA = 'canciones';

// Abre (o crea) la base de datos del navegador
function abrirDB() {
    return new Promise((resolve, reject) => {
        const solicitud = indexedDB.open(NOMBRE_DB, 1);

        solicitud.onupgradeneeded = () => {
            solicitud.result.createObjectStore(TIENDA, { keyPath: 'id' });
        };
        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

// Reemplaza la biblioteca guardada por los archivos nuevos
async function guardarEnDB(archivos) {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(TIENDA, 'readwrite');
        const tienda = tx.objectStore(TIENDA);

        tienda.clear();
        archivos.forEach((archivo, i) => tienda.put({ id: i, archivo }));

        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
    });
}

// Lee los archivos guardados, en el mismo orden en que se guardaron
async function leerDeDB() {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const solicitud = db.transaction(TIENDA, 'readonly')
            .objectStore(TIENDA)
            .getAll();

        solicitud.onsuccess = () => {
            db.close();
            resolve(solicitud.result.map(r => r.archivo));
        };
        solicitud.onerror = () => reject(solicitud.error);
    });
}

// Construye la playlist con una lista de archivos.
// Si "guardar" es true, también los guarda en IndexedDB.
async function cargarPlaylist(archivos, guardar) {
    // Liberar los recursos de la lista anterior
    playlist.forEach(cancion => {
        URL.revokeObjectURL(cancion.url);
        if (cancion.portadaUrl) URL.revokeObjectURL(cancion.portadaUrl);
    });

    playlist = archivos.map(archivo => ({
        nombreOriginal: archivo.name.replace(/\.[^/.]+$/, ''),
        analisis: analizarNombre(archivo.name),
        archivo,
        url: URL.createObjectURL(archivo),
        infoPromesa: null,
        portadaUrl: null
    }));

    indiceActual = 0;
    construirOrden();

    // Si la última canción escuchada está en la biblioteca, se selecciona
    const estado = leerEstado();
    const guardada = estado
        ? playlist.findIndex(c => c.archivo.name === estado.nombre)
        : -1;

    if (guardada >= 0) {
        indiceActual = guardada;
        construirOrden();
        cargarCancion(indiceActual);
        // Posiciona la canción en el segundo guardado, sin reproducirla
        audio.addEventListener('loadedmetadata', () => {
            audio.currentTime = Math.min(estado.segundo, audio.duration || 0);
        }, { once: true });
    } else {
        cargarCancion(indiceActual);
    }

    renderLista();
    precargarAlbumes();

    if (guardar) {
        try {
            await guardarEnDB(archivos);
        } catch (error) {
            console.error('No se pudo guardar la biblioteca:', error);
        }
    }
}

// Al elegir archivos, se reemplaza la biblioteca y se guarda
selectorArchivos.addEventListener('change', (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length === 0) return;

    cargarPlaylist(archivos, true);
});

// Al abrir la app, se carga la biblioteca guardada, si existe
leerDeDB()
    .then(archivos => {
        if (archivos.length > 0) cargarPlaylist(archivos, false);
    })
    .catch(error => {
        console.error('No se pudo leer la biblioteca:', error);
    });

// ===== CARGAR UNA CANCIÓN =====
function cargarCancion(indice) {
    if (indice < 0 || indice >= playlist.length) return;

    const cancion = playlist[indice];

    audio.src = cancion.url;
    audio.load();
    audio.playbackRate = VELOCIDADES[indiceVelocidad];

    barraProgreso.value = 0;
    tiempoActual.textContent = '0:00';
    tiempoRestante.textContent = '-0:00';

    imgPortada.hidden = true;

    // Mostrar primero los datos obtenidos del nombre del archivo.
    titulo.textContent = cancion.analisis.titulo;
    artista.textContent =
        cancion.analisis.artista || 'Artista desconocido';

    album.textContent = '';
    pista.textContent = `Pista ${indice + 1} de ${playlist.length}`;

    animar(imgPortada, 'animar');
    animar(
        document.querySelector('.informacion-cancion'),
        'animar'
    );

    mostrarInfo(cancion);
    marcarActual();
    actualizarFavoritaActual();
}

// ===== FORMATEAR TIEMPOS =====
function formatearTiempo(segundos) {
    if (!isFinite(segundos) || segundos < 0) {
        return '0:00';
    }

    const min = Math.floor(segundos / 60);
    const seg = Math.floor(segundos % 60)
        .toString()
        .padStart(2, '0');

    return `${min}:${seg}`;
}

// ===== ACTUALIZAR TIEMPOS =====
function actualizarTiempos() {
    const duracion = audio.duration;

    tiempoActual.textContent = formatearTiempo(
        audio.currentTime
    );

    tiempoRestante.textContent = isFinite(duracion)
        ? '-' + formatearTiempo(duracion - audio.currentTime)
        : '-0:00';
}

audio.addEventListener('timeupdate', actualizarTiempos);
audio.addEventListener('loadedmetadata', actualizarTiempos);

// ===== EXTRAER COLORES DE LA PORTADA =====
function extraerColores(url) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            const lienzo = document.createElement('canvas');

            lienzo.width = 32;
            lienzo.height = 32;

            const ctx = lienzo.getContext('2d', {
                willReadFrequently: true
            });

            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0, 32, 32);

            let datos;

            try {
                datos = ctx.getImageData(
                    0, 0, 32, 32
                ).data;
            } catch (error) {
                resolve(null);
                return;
            }

            const suma = [0, 0, 0];
            const vivos = [0, 0, 0];

            let n = 0;
            let nVivos = 0;

            for (let i = 0; i < datos.length; i += 4) {
                const r = datos[i];
                const g = datos[i + 1];
                const b = datos[i + 2];

                suma[0] += r;
                suma[1] += g;
                suma[2] += b;

                n++;

                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);

                if (max - min > 40 && max > 60) {
                    vivos[0] += r;
                    vivos[1] += g;
                    vivos[2] += b;

                    nVivos++;
                }
            }

            const promedio = suma.map(v => v / n);

            const vivo = nVivos
                ? vivos.map(v => v / nVivos)
                : promedio;

            resolve({ promedio, vivo });
        };

        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// ===== MEZCLAR COLORES =====
function mezclar(color, otro, p) {
    return color.map((v, i) =>
        Math.round(v * (1 - p) + otro[i] * p)
    );
}

// ===== APLICAR TEMA DE COLORES =====
function aplicarTema(colores) {
    ultimosColores = colores;

    const estilo = document.documentElement.style;
    const variables = ['--fondo-1', '--fondo-2', '--fondo-3', '--acento', '--acento-rgb'];

    // Sin portada, se usan los colores del CSS (claro u oscuro)
    if (!colores) {
        variables.forEach(v => estilo.removeProperty(v));
        return;
    }

    const { promedio, vivo } = colores;
    const rgb = c => `rgb(${c.join(', ')})`;

    if (temaOscuro) {
        // Fondos oscuros y acento claro
        const acento = mezclar(vivo, [255, 255, 255], 0.35);
        estilo.setProperty('--fondo-1', rgb(mezclar(promedio, [0, 0, 0], 0.6)));
        estilo.setProperty('--fondo-2', rgb(mezclar(vivo, [0, 0, 0], 0.7)));
        estilo.setProperty('--fondo-3', rgb(mezclar(promedio, [0, 0, 0], 0.8)));
        estilo.setProperty('--acento', rgb(acento));
        estilo.setProperty('--acento-rgb', acento.join(', '));
    } else {
        // Fondos claros y acento oscuro
        const blanco = [255, 255, 255];
        const oscuro = mezclar(vivo, [0, 0, 0], 0.45);
        estilo.setProperty('--fondo-1', rgb(mezclar(promedio, blanco, 0.6)));
        estilo.setProperty('--fondo-2', rgb(mezclar(vivo, blanco, 0.75)));
        estilo.setProperty('--fondo-3', rgb(mezclar(promedio, blanco, 0.4)));
        estilo.setProperty('--acento', rgb(oscuro));
        estilo.setProperty('--acento-rgb', oscuro.join(', '));
    }
}
// ===== CONTROLES DE REPRODUCCIÓN =====
audio.addEventListener('play', () => {
    btnReproducir.textContent = '⏸';
});

audio.addEventListener('pause', () => {
    btnReproducir.textContent = '▶';
});

btnReproducir.addEventListener('click', () => {
    if (!audio.getAttribute('src')) return;

    if (audio.paused) {
        reproducirAudio();
    } else {
        audio.pause();
    }
});

// ===== CANCIÓN SIGUIENTE =====
btnSiguiente.addEventListener('click', () => {
    if (playlist.length === 0) return;

    const pos = orden.indexOf(indiceActual);
    const siguiente = (pos + 1) % orden.length;

    irA(orden[siguiente]);
});

// ===== CANCIÓN ANTERIOR =====
btnAnterior.addEventListener('click', () => {
    if (playlist.length === 0) return;

    const pos = orden.indexOf(indiceActual);
    const anterior = (pos - 1 + orden.length) % orden.length;

    irA(orden[anterior]);
});

// ===== MODO ALEATORIO =====
btnAleatorio.addEventListener('click', () => {
    aleatorio = !aleatorio;

    btnAleatorio.classList.toggle('activo', aleatorio);

    btnAleatorio.setAttribute(
        'aria-pressed',
        String(aleatorio)
    );

    construirOrden();
});

// ===== ACTUALIZAR BARRA DE PROGRESO =====
audio.addEventListener('timeupdate', () => {
    if (
        isFinite(audio.duration) &&
        audio.duration > 0
    ) {
        barraProgreso.value =
            (audio.currentTime / audio.duration) * 100;
    }
});

// ===== CAMBIAR POSICIÓN DE LA CANCIÓN =====
barraProgreso.addEventListener('input', () => {
    if (
        isFinite(audio.duration) &&
        audio.duration > 0
    ) {
        audio.currentTime =
            (barraProgreso.value / 100) * audio.duration;
    }
});

// ===== REPRODUCCIÓN AUTOMÁTICA AL TERMINAR =====
audio.addEventListener('ended', () => {
    // Repetir una canción: vuelve a empezar la misma
    if (modoRepetir === 'una') {
        audio.currentTime = 0;
        reproducirAudio();
        return;
    }

    const pos = orden.indexOf(indiceActual);

    if (pos >= 0 && pos < orden.length - 1) {
        irA(orden[pos + 1]);
    } else if (modoRepetir === 'lista' && orden.length > 0) {
        // Al llegar al final, repetir la lista desde el principio
        irA(orden[0]);
    }
});

// ===== REINICIAR ANIMACIONES CSS =====
function animar(elemento, clase) {
    if (!elemento) return;

    elemento.classList.remove(clase);

    // Forzar el reflujo para reiniciar la animación.
    void elemento.offsetWidth;

    elemento.classList.add(clase);
}

// ===== LISTA DE CANCIONES =====
const btnLista = document.getElementById('btnLista');
const tarjetaLista = document.getElementById('tarjetaLista');
const listaCanciones = document.getElementById('listaCanciones');
const cerrarLista = document.getElementById('cerrarLista');

btnLista.addEventListener('click', () => {
    tarjetaLista.hidden = !tarjetaLista.hidden;
});

cerrarLista.addEventListener('click', () => {
    tarjetaLista.hidden = true;
});

// Crea una fila (li) para la canción con índice i de la playlist
function crearFila(i) {
    const cancion = playlist[i];
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.dataset.indice = i;

    const texto = document.createElement('span');
    texto.className = 'texto-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-favorita';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        alternarFavorita(i);
    });

    li.append(texto, btn);
    li.addEventListener('click', () => seleccionar(i));
    li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') seleccionar(i);
    });

    pintarItemEn(li, i, cancion.analisis.titulo, cancion.analisis.artista);
    actualizarBotonFavoritaEn(li, i);
    return li;
}

// Crea todas las filas de la lista
function renderLista() {
    reordenarLista();
}

// ===== ARRASTRAR LA TARJETA DE LA LISTA =====
let arrastrandoLista = false;
let lista_desplazX = 0;
let lista_desplazY = 0;

tarjetaLista.addEventListener('pointerdown', (e) => {
    // En el teléfono la lista ocupa toda la pantalla, no se mueve.
    // No arrastrar desde la lista de canciones ni desde los botones.
    if (
        esMovil() ||
        e.target.closest('button, input, label, li, .asa-redimensionar')
    ) {
        return;
    }

    const rect = tarjetaLista.getBoundingClientRect();

    tarjetaLista.style.transform = 'none';
    tarjetaLista.style.left = rect.left + 'px';
    tarjetaLista.style.top = rect.top + 'px';

    lista_desplazX = e.clientX - rect.left;
    lista_desplazY = e.clientY - rect.top;

    arrastrandoLista = true;
    tarjetaLista.setPointerCapture(e.pointerId);
});

tarjetaLista.addEventListener('pointermove', (e) => {
    if (!arrastrandoLista) return;

    let x = e.clientX - lista_desplazX;
    let y = e.clientY - lista_desplazY;

    const maxX = window.innerWidth - tarjetaLista.offsetWidth;
    const maxY = window.innerHeight - tarjetaLista.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    tarjetaLista.style.left = x + 'px';
    tarjetaLista.style.top = y + 'px';
});

function terminarArrastreLista() {
    arrastrandoLista = false;
}

tarjetaLista.addEventListener('pointerup', terminarArrastreLista);
tarjetaLista.addEventListener('pointercancel', terminarArrastreLista);

// ===== VOLUMEN =====
const volumen = document.getElementById('volumen');

volumen.addEventListener('input', () => {
    audio.volume = Number(volumen.value);
});

// ===== REPETIR =====
const btnRepetir = document.getElementById('repetir');
const MODOS_REPETIR = ['no', 'lista', 'una'];
const ICONOS_REPETIR = { no: '🔁', lista: '🔁', una: '🔂' };
let modoRepetir = 'no';

btnRepetir.addEventListener('click', () => {
    const siguiente = (MODOS_REPETIR.indexOf(modoRepetir) + 1) % MODOS_REPETIR.length;
    modoRepetir = MODOS_REPETIR[siguiente];

    btnRepetir.textContent = ICONOS_REPETIR[modoRepetir];
    btnRepetir.classList.toggle('activo', modoRepetir !== 'no');
    btnRepetir.classList.toggle('repetir-apagado', modoRepetir === 'no');
    btnRepetir.setAttribute('aria-label', `Repetir: ${modoRepetir}`);
});

// ===== TEMA CLARO / OSCURO =====
const btnTema = document.getElementById('tema');
let temaOscuro = false;
let ultimosColores = null; // colores de la portada actual

btnTema.addEventListener('click', () => {
    temaOscuro = !temaOscuro;

    document.documentElement.classList.toggle('oscuro', temaOscuro);
    btnTema.textContent = temaOscuro ? '☀️' : '🌙';
    btnTema.classList.toggle('activo', temaOscuro);
    btnTema.setAttribute('aria-pressed', String(temaOscuro));

    // Vuelve a calcular los colores de la portada con el tema nuevo
    aplicarTema(ultimosColores);
});

// ===== VELOCIDAD DE REPRODUCCIÓN =====
const btnVelocidad = document.getElementById('velocidad');
const VELOCIDADES = [1, 1.25, 0.75];
let indiceVelocidad = 0;

btnVelocidad.addEventListener('click', () => {
    indiceVelocidad = (indiceVelocidad + 1) % VELOCIDADES.length;
    const velocidad = VELOCIDADES[indiceVelocidad];

    audio.playbackRate = velocidad;
    btnVelocidad.textContent = `${velocidad}×`;
    btnVelocidad.setAttribute('aria-label', `Velocidad ${velocidad}x`);
});

// ===== CONTROLES EN LA PANTALLA DE BLOQUEO Y EN EL SISTEMA =====
function actualizarMediaSession(info) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: info.titulo || 'Sin título',
        artist: info.artista || 'Artista desconocido',
        album: info.album || '',
        artwork: info.portada
            ? [{ src: info.portada, sizes: '512x512', type: 'image/jpeg' }]
            : []
    });
}

function configurarControlesSistema() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => reproducirAudio());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => btnAnterior.click());
    navigator.mediaSession.setActionHandler('nexttrack', () => btnSiguiente.click());
}

configurarControlesSistema();

// Mantiene el estado (reproduciendo o en pausa) sincronizado con el sistema
audio.addEventListener('play', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});

audio.addEventListener('pause', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

// ===== BUSCADOR =====
const buscador = document.getElementById('buscador');

buscador.addEventListener('input', aplicarFiltro);

function aplicarFiltro() {
    const texto = buscador.value.trim().toLowerCase();

    [...listaCanciones.children].forEach(li => {
        const i = Number(li.dataset.indice);

        // Busca en el título, el artista y el álbum
        const textoFila = (
            li.querySelector('.texto-item').textContent + ' ' +
            (li.dataset.album || '')
        ).toLowerCase();

        const coincideTexto = texto === '' || textoFila.includes(texto);
        const coincideFavorita = !soloFavoritas || esFavorita(playlist[i]);

        li.hidden = !(coincideTexto && coincideFavorita);
    });
}
// ===== ATAJOS DE TECLADO =====
document.addEventListener('keydown', (e) => {
    // No interferir cuando se escribe en el buscador o se mueve un control
    if (e.target.matches('input, textarea')) return;
    if (!audio.getAttribute('src')) return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            btnReproducir.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            audio.currentTime = Math.max(0, audio.currentTime - 5);
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (isFinite(audio.duration)) {
                audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            btnAnterior.click();
            break;
        case 'ArrowDown':
            e.preventDefault();
            btnSiguiente.click();
            break;
        case 'm':
        case 'M':
            // Silenciar o reactivar el sonido
            audio.muted = !audio.muted;
            document.querySelector('.icono-volumen').textContent =
                audio.muted ? '🔇' : '🔊';
            break;
        case 'r':
        case 'R':
            // Cambia el modo de repetir, igual que el botón 🔁
            btnRepetir.click();
            break;
    }
});

// ===== VISUALIZADOR DE AUDIO =====
const canvas = document.getElementById('visualizador');
const ctxCanvas = canvas.getContext('2d');

let audioCtx = null;
let analizador = null;
let datosFrecuencia = null;
let dibujando = false;

// Se crea la conexión con el audio la primera vez que suena
function iniciarVisualizador() {
    if (!audioCtx) {
        const ContextoAudio = window.AudioContext || window.webkitAudioContext;
        audioCtx = new ContextoAudio();

        const fuente = audioCtx.createMediaElementSource(audio);
        analizador = audioCtx.createAnalyser();
        analizador.fftSize = 128;
        datosFrecuencia = new Uint8Array(analizador.frequencyBinCount);

        fuente.connect(analizador);
        analizador.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (!dibujando) {
        dibujando = true;
        dibujarVisualizador();
    }
}

function dibujarVisualizador() {
    // En pausa se limpia el canvas y se detiene el dibujo
    if (audio.paused) {
        dibujando = false;
        ctxCanvas.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    requestAnimationFrame(dibujarVisualizador);
    analizador.getByteFrequencyData(datosFrecuencia);

    const { width: w, height: h } = canvas;
    const rgb = getComputedStyle(document.documentElement)
        .getPropertyValue('--acento-rgb')
        .trim();

    ctxCanvas.clearRect(0, 0, w, h);

    // Degradado: más intenso arriba y más suave abajo
    const degradado = ctxCanvas.createLinearGradient(0, 0, 0, h);
    degradado.addColorStop(0, `rgba(${rgb}, 0.95)`);
    degradado.addColorStop(1, `rgba(${rgb}, 0.35)`);
    ctxCanvas.fillStyle = degradado;

    // Brillo suave alrededor de las barras
    ctxCanvas.shadowColor = `rgba(${rgb}, 0.5)`;
    ctxCanvas.shadowBlur = 8;

    const barras = 32;
    const espacio = w / barras;
    const grosor = espacio * 0.6;

    for (let i = 0; i < barras; i++) {
        const valor = datosFrecuencia[i] / 255;
        const alto = Math.max(3, valor * h * 0.9);
        const x = i * espacio + (espacio - grosor) / 2;
        const y = h - alto;

        ctxCanvas.beginPath();
        ctxCanvas.roundRect(x, y, grosor, alto, grosor / 2);
        ctxCanvas.fill();
    }

    // Se quita el brillo para no afectar otros dibujos
    ctxCanvas.shadowBlur = 0;
}

audio.addEventListener('play', iniciarVisualizador);

// ===== ESTIRAR LA TARJETA DE LA LISTA =====
const asaLista = document.getElementById('asaLista');
let redimensionandoLista = false;
let inicioXLista = 0;
let anchoInicialLista = 0;

asaLista.addEventListener('pointerdown', (e) => {
    e.stopPropagation();

    if (esMovil()) return;

    const rect = tarjetaLista.getBoundingClientRect();

    // Fijar la posición actual para que la lista crezca hacia la derecha
    tarjetaLista.style.transform = 'none';
    tarjetaLista.style.left = rect.left + 'px';
    tarjetaLista.style.top = rect.top + 'px';
    tarjetaLista.style.width = rect.width + 'px';

    redimensionandoLista = true;
    inicioXLista = e.clientX;
    anchoInicialLista = rect.width;

    asaLista.setPointerCapture(e.pointerId);
});

asaLista.addEventListener('pointermove', (e) => {
    if (!redimensionandoLista) return;

    const izquierda = parseFloat(tarjetaLista.style.left) || 0;
    const maximo = Math.max(
        ANCHO_MINIMO,
        window.innerWidth - izquierda - 8
    );

    const nuevo = anchoInicialLista + (e.clientX - inicioXLista);
    const ancho = Math.max(ANCHO_MINIMO, Math.min(nuevo, maximo));

    tarjetaLista.style.width = ancho + 'px';
});

function terminarRedimensionLista() {
    redimensionandoLista = false;
}

asaLista.addEventListener('pointerup', terminarRedimensionLista);
asaLista.addEventListener('pointercancel', terminarRedimensionLista);

// ===== RECORDAR DÓNDE TE QUEDASTE =====
const CLAVE_ESTADO = 'reproductor-estado';
let estadoPendiente = null;

// Lee lo guardado al abrir la app
function leerEstado() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_ESTADO)) || null;
    } catch (error) {
        return null;
    }
}

// Guarda el estado actual. Se llama cada cierto tiempo y al pausar
function guardarEstado() {
    const cancion = playlist[indiceActual];
    if (!cancion) return;

    const estado = {
        nombre: cancion.archivo.name,
        segundo: Math.floor(audio.currentTime),
        volumen: audio.volume,
        temaOscuro
    };

    try {
        localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
    } catch (error) {
        // El almacenamiento puede estar lleno o bloqueado.
    }
}

// Guarda cada 5 segundos mientras suena, y al pausar o cerrar
let ultimoGuardado = 0;
audio.addEventListener('timeupdate', () => {
    if (Date.now() - ultimoGuardado > 5000) {
        ultimoGuardado = Date.now();
        guardarEstado();
    }
});
audio.addEventListener('pause', guardarEstado);
window.addEventListener('pagehide', guardarEstado);

// Aplica el volumen y el tema guardados al abrir la app
const estadoInicial = leerEstado();
if (estadoInicial) {
    audio.volume = typeof estadoInicial.volumen === 'number' ? estadoInicial.volumen : 1;
    volumen.value = audio.volume;

    if (estadoInicial.temaOscuro) btnTema.click();
}

// ===== FAVORITOS =====
const CLAVE_FAVORITAS = 'reproductor-favoritas';
const btnFiltroFavoritas = document.getElementById('filtroFavoritas');
let soloFavoritas = false;
let favoritas = [];

try {
    favoritas = JSON.parse(localStorage.getItem(CLAVE_FAVORITAS)) || [];
} catch (error) {
    favoritas = [];
}

function guardarFavoritas() {
    try {
        localStorage.setItem(CLAVE_FAVORITAS, JSON.stringify(favoritas));
    } catch (error) {
        // El almacenamiento puede estar lleno o bloqueado.
    }
}

function esFavorita(cancion) {
    return favoritas.includes(cancion.archivo.name);
}

function alternarFavorita(i) {
    const nombre = playlist[i].archivo.name;

    favoritas = favoritas.includes(nombre)
        ? favoritas.filter(n => n !== nombre)
        : [...favoritas, nombre];

    guardarFavoritas();
    playlist.forEach((_, j) => actualizarBotonFavorita(j));
    aplicarFiltro();
    actualizarFavoritaActual();
}

btnFiltroFavoritas.addEventListener('click', () => {
    soloFavoritas = !soloFavoritas;

    btnFiltroFavoritas.classList.toggle('activo', soloFavoritas);
    btnFiltroFavoritas.setAttribute('aria-pressed', String(soloFavoritas));
    btnFiltroFavoritas.textContent = soloFavoritas ? '♥' : '♡';

    aplicarFiltro();
});

// ===== ORDEN DE LA LISTA =====
const btnOrdenar = document.getElementById('ordenarLista');
const MODOS_ORDEN = ['original', 'titulo', 'artista'];
const ETIQUETAS_ORDEN = {
    original: 'Ordenar: original',
    titulo: 'Ordenar: por título',
    artista: 'Ordenar: por artista'
};
let modoOrden = 'original';

// Devuelve las canciones en el orden elegido, sin cambiar la playlist
function ordenarCanciones(indices) {
    const copia = [...indices];

    if (modoOrden === 'titulo') {
        copia.sort((a, b) => playlist[a].analisis.titulo
            .localeCompare(playlist[b].analisis.titulo, 'es', { sensitivity: 'base' }));
    } else if (modoOrden === 'artista') {
        copia.sort((a, b) => (playlist[a].analisis.artista || '')
            .localeCompare(playlist[b].analisis.artista || '', 'es', { sensitivity: 'base' }));
    }
    return copia;
}

// Vuelve a dibujar la lista según el orden elegido
function reordenarLista() {
    const indices = ordenarCanciones(playlist.map((_, i) => i));
    listaCanciones.innerHTML = '';

    indices.forEach(i => {
        const li = crearFila(i);
        listaCanciones.appendChild(li);
    });

    marcarActual();
    aplicarFiltro();
}

btnOrdenar.addEventListener('click', () => {
    const siguiente = (MODOS_ORDEN.indexOf(modoOrden) + 1) % MODOS_ORDEN.length;
    modoOrden = MODOS_ORDEN[siguiente];

    btnOrdenar.setAttribute('aria-label', ETIQUETAS_ORDEN[modoOrden]);
    btnOrdenar.classList.toggle('activo', modoOrden !== 'original');

    reordenarLista();
});

// Busca la fila de una canción por su índice en la playlist
function filaDe(i) {
    return listaCanciones.querySelector(`li[data-indice="${i}"]`);
}

function pintarItem(i, titulo, artista) {
    const li = filaDe(i);
    if (li) pintarItemEn(li, i, titulo, artista);
}

function pintarItemEn(li, i, titulo, artista) {
    const texto = li.querySelector('.texto-item');
    let contenido = `${i + 1}. ${titulo || 'Sin título'}`;
    if (artista) contenido += ` — ${artista}`;
    texto.textContent = contenido;
}

function actualizarBotonFavorita(i) {
    const li = filaDe(i);
    if (li) actualizarBotonFavoritaEn(li, i);
}

function actualizarBotonFavoritaEn(li, i) {
    const btn = li.querySelector('.btn-favorita');
    const favorita = esFavorita(playlist[i]);
    btn.textContent = favorita ? '♥' : '♡';
    btn.classList.toggle('activa', favorita);
    btn.setAttribute(
        'aria-label',
        favorita ? 'Quitar de favoritas' : 'Añadir a favoritas'
    );
}

function marcarActual() {
    [...listaCanciones.children].forEach(li => {
        li.classList.toggle('actual', Number(li.dataset.indice) === indiceActual);
    });
}

// Reproduce la canción elegida en la lista
function seleccionar(i) {
    indiceActual = i;
    construirOrden();
    irA(i);
}

// Guarda el álbum en la fila de la canción, para que el buscador lo use
function guardarAlbumEnFila(i, album) {
    const li = filaDe(i);
    if (li) li.dataset.album = album || '';
}

// Lee el álbum de todas las canciones en segundo plano
function precargarAlbumes() {
    playlist.forEach((cancion, i) => {
        obtenerInfo(cancion).then(info => {
            // Si mientras tanto se cargó otra biblioteca, no se usa este dato
            if (playlist[i] !== cancion) return;

            guardarAlbumEnFila(i, info.album);
            aplicarFiltro();
        });
    });
}

// ===== FAVORITA DE LA CANCIÓN ACTUAL =====
const btnFavoritaActual = document.getElementById('favoritaActual');

// Muestra ♥ o ♡ según la canción que está sonando
function actualizarFavoritaActual() {
    const cancion = playlist[indiceActual];
    const favorita = cancion ? esFavorita(cancion) : false;

    btnFavoritaActual.textContent = favorita ? '♥' : '♡';
    btnFavoritaActual.classList.toggle('activa', favorita);
    btnFavoritaActual.setAttribute('aria-pressed', String(favorita));
    btnFavoritaActual.setAttribute(
        'aria-label',
        favorita ? 'Quitar de favoritas' : 'Añadir a favoritas'
    );
    btnFavoritaActual.disabled = !cancion;
}

btnFavoritaActual.addEventListener('click', () => {
    if (playlist[indiceActual]) alternarFavorita(indiceActual);
});

// ===== REPRODUCIR TODO / MEZCLAR TODO =====
const btnReproducirTodo = document.getElementById('reproducirTodo');
const btnMezclarTodo = document.getElementById('mezclarTodo');

// Inicia la biblioteca completa. Con "mezclar", el modo aleatorio se activa
function reproducirTodo(mezclar) {
    if (playlist.length === 0) return;

    aleatorio = mezclar;
    btnAleatorio.classList.toggle('activo', mezclar);
    btnAleatorio.setAttribute('aria-pressed', String(mezclar));

    // Si es aleatorio, la primera canción también se elige al azar
    indiceActual = mezclar
        ? Math.floor(Math.random() * playlist.length)
        : 0;

    construirOrden();
    irA(indiceActual);
}

btnReproducirTodo.addEventListener('click', () => reproducirTodo(false));
btnMezclarTodo.addEventListener('click', () => reproducirTodo(true));

// ===== PROTEGER LA PORTADA =====
// Bloquea el menú del clic derecho sobre la imagen
imgPortada.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Evita arrastrar la imagen a otra pestaña o al escritorio
imgPortada.addEventListener('dragstart', (e) => {
    e.preventDefault();
});