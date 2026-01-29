require('dotenv').config();
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');

// Datos de departamentos y municipios de Nicaragua
const nicaraguaGeoData = {
  "Boaco": [
    "Boaco", "Camoapa", "San José de los Remates", "San Lorenzo", "Santa Lucía", "Teustepe"
  ],
  "Carazo": [
    "Jinotepe", "Diriamba", "Dolores", "El Rosario", "La Conquista", "La Paz de Carazo", "San Marcos", "Santa Teresa"
  ],
  "Chinandega": [
    "Chinandega", "Chichigalpa", "Cinco Pinos", "Corinto", "El Realejo", "El Viejo", "Posoltega", "Puerto Morazán", "San Francisco del Norte", "San Pedro del Norte", "Santo Tomás del Norte", "Somotillo", "Villanueva"
  ],
  "Chontales": [
    "Juigalpa", "Acoyapa", "Comalapa", "Cuapa", "El Coral", "La Libertad", "San Francisco de Cuapa", "San Pedro de Lóvago", "Santo Domingo", "Santo Tomás", "Villa Sandino"
  ],
  "Estelí": [
    "Estelí", "Condega", "La Trinidad", "Pueblo Nuevo", "San Juan de Limay", "San Nicolás"
  ],
  "Granada": [
    "Granada", "Diriá", "Diriomo", "Nandaime"
  ],
  "Jinotega": [
    "Jinotega", "El Cuá", "La Concordia", "San José de Bocay", "San Rafael del Norte", "San Sebastián de Yalí", "Santa María de Pantasma", "Wiwilí de Jinotega"
  ],
  "León": [
    "León", "Achuapa", "El Jicaral", "El Sauce", "La Paz Centro", "Larreynaga", "Nagarote", "Quezalguaque", "Santa Rosa del Peñón", "Telica"
  ],
  "Madriz": [
    "Somoto", "Las Sabanas", "Palacagüina", "San José de Cusmapa", "San Juan de Río Coco", "San Lucas", "Telpaneca", "Totogalpa", "Yalagüina"
  ],
  "Managua": [
    "Managua", "Ciudad Sandino", "El Crucero", "Mateare", "San Francisco Libre", "San Rafael del Sur", "Ticuantepe", "Tipitapa", "Villa Carlos Fonseca"
  ],
  "Masaya": [
    "Masaya", "Catarina", "La Concepción", "Masatepe", "Nandasmo", "Nindirí", "Niquinohomo", "San Juan de Oriente", "Tisma"
  ],
  "Matagalpa": [
    "Matagalpa", "Ciudad Darío", "El Tuma-La Dalia", "Esquipulas", "Matiguás", "Muy Muy", "Rancho Grande", "Río Blanco", "San Dionisio", "San Isidro", "San Ramón", "Sébaco", "Terrabona"
  ],
  "Nueva Segovia": [
    "Ocotal", "Ciudad Antigua", "Dipilto", "El Jícaro", "Jalapa", "Macuelizo", "Mozonte", "Murra", "Quilalí", "San Fernando", "Santa María", "Wiwilí de Nueva Segovia"
  ],
  "Río San Juan": [
    "San Carlos", "El Almendro", "El Castillo", "Morrito", "San Juan de Nicaragua", "San Miguelito"
  ],
  "Rivas": [
    "Rivas", "Altagracia", "Belén", "Buenos Aires", "Cárdenas", "Moyogalpa", "Potosí", "San Jorge", "San Juan del Sur", "Tola"
  ],
  "RACCS": [
    "Bluefields", "Corn Island", "Desembocadura de la Cruz de Río Grande", "El Ayote", "El Rama", "El Tortuguero", "Kukra Hill", "La Cruz de Río Grande", "Laguna de Perlas", "Muelle de los Bueyes", "Nueva Guinea", "Paiwas"
  ],
  "RACCN": [
    "Puerto Cabezas", "Bonanza", "Mulukukú", "Prinzapolka", "Rosita", "Siuna", "Waslala", "Waspam"
  ]
};

async function populateGeoData() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('=== POBLANDO DATOS GEOGRÁFICOS ===\n');

    // Limpiar tablas existentes
    await connection.execute('DELETE FROM municipalities');
    await connection.execute('DELETE FROM departments');
    console.log('🧹 Tablas limpiadas');

    // Insertar departamentos y municipios
    for (const [departmentName, municipalities] of Object.entries(nicaraguaGeoData)) {
      const departmentId = randomUUID();
      
      // Insertar departamento
      await connection.execute(
        'INSERT INTO departments (id, name) VALUES (?, ?)',
        [departmentId, departmentName]
      );
      console.log(`✅ Departamento: ${departmentName}`);

      // Insertar municipios
      for (const municipalityName of municipalities) {
        const municipalityId = randomUUID();
        await connection.execute(
          'INSERT INTO municipalities (id, name, departmentId) VALUES (?, ?, ?)',
          [municipalityId, municipalityName, departmentId]
        );
      }
      console.log(`   📍 ${municipalities.length} municipios agregados`);
    }

    // Mostrar resumen
    const [deptCount] = await connection.execute('SELECT COUNT(*) as count FROM departments');
    const [muniCount] = await connection.execute('SELECT COUNT(*) as count FROM municipalities');
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   Departamentos: ${deptCount[0].count}`);
    console.log(`   Municipios: ${muniCount[0].count}`);
    console.log('\n✅ Datos geográficos poblados exitosamente');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

populateGeoData();