const backgroundImages = [
    'img/baby.jpg',
    'img/baby1.jpg',
    'img/baby2.jpeg',
    'img/baby3.jpg',
    'img/baby4.jpeg'
    // Agrega aquí cualquier otra imagen que añadas a la carpeta img/
];

let currentImageIndex = 0;

function rotateBackgroundImage() {
    const imageUrl = backgroundImages[currentImageIndex];
    // Aplica la imagen al cuerpo del documento
    document.body.style.backgroundImage = `url('${imageUrl}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';

    // Avanzar al siguiente índice, volviendo al 0 si llegamos al final
    currentImageIndex = (currentImageIndex + 1) % backgroundImages.length;
}

// Inicializar fondo y configurar rotación cada 10 minutos (600000 ms)
rotateBackgroundImage();
setInterval(rotateBackgroundImage, 600000);
