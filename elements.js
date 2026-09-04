/* elements.js — dataset + derived chemistry.
   Row format: z|symbol|name|mass|category|group|period|electronegativity|melt K|boil K|density g/cm3|oxidation states|discovered
   Blank field = unknown. Negative year = antiquity (BCE). */

const RAW = `
1|H|Hydrogen|1.008|nonmetal|1|1|2.20|13.99|20.27|0.00008988|1,-1|1766
2|He|Helium|4.0026|noble|18|1||0.95|4.22|0.0001785|0|1868
3|Li|Lithium|6.94|alkali|1|2|0.98|453.65|1603|0.534|1|1817
4|Be|Beryllium|9.0122|alkaline|2|2|1.57|1560|2742|1.85|2|1798
5|B|Boron|10.81|metalloid|13|2|2.04|2349|4200|2.34|3|1808
6|C|Carbon|12.011|nonmetal|14|2|2.55|3823|4098|2.267|4,-4|-3750
7|N|Nitrogen|14.007|nonmetal|15|2|3.04|63.15|77.36|0.0012506|-3,5,3|1772
8|O|Oxygen|15.999|nonmetal|16|2|3.44|54.36|90.20|0.001429|-2|1771
9|F|Fluorine|18.998|halogen|17|2|3.98|53.53|85.03|0.001696|-1|1886
10|Ne|Neon|20.180|noble|18|2||24.56|27.07|0.0008999|0|1898
11|Na|Sodium|22.990|alkali|1|3|0.93|370.94|1156|0.968|1|1807
12|Mg|Magnesium|24.305|alkaline|2|3|1.31|923|1363|1.738|2|1755
13|Al|Aluminium|26.982|post|13|3|1.61|933.47|2792|2.70|3|1825
14|Si|Silicon|28.085|metalloid|14|3|1.90|1687|3538|2.329|4,-4|1824
15|P|Phosphorus|30.974|nonmetal|15|3|2.19|317.30|553.65|1.823|5,3,-3|1669
16|S|Sulfur|32.06|nonmetal|16|3|2.58|388.36|717.8|2.07|-2,4,6|-2000
17|Cl|Chlorine|35.45|halogen|17|3|3.16|171.6|239.11|0.003214|-1,1,5,7|1774
18|Ar|Argon|39.95|noble|18|3||83.80|87.30|0.0017837|0|1894
19|K|Potassium|39.098|alkali|1|4|0.82|336.53|1032|0.862|1|1807
20|Ca|Calcium|40.078|alkaline|2|4|1.00|1115|1757|1.55|2|1808
21|Sc|Scandium|44.956|transition|3|4|1.36|1814|3109|2.985|3|1879
22|Ti|Titanium|47.867|transition|4|4|1.54|1941|3560|4.506|4,3|1791
23|V|Vanadium|50.942|transition|5|4|1.63|2183|3680|6.11|5,4,3,2|1801
24|Cr|Chromium|51.996|transition|6|4|1.66|2180|2944|7.15|3,6,2|1794
25|Mn|Manganese|54.938|transition|7|4|1.55|1519|2334|7.21|2,4,7|1774
26|Fe|Iron|55.845|transition|8|4|1.83|1811|3134|7.874|3,2|-5000
27|Co|Cobalt|58.933|transition|9|4|1.88|1768|3200|8.90|2,3|1735
28|Ni|Nickel|58.693|transition|10|4|1.91|1728|3186|8.908|2,3|1751
29|Cu|Copper|63.546|transition|11|4|1.90|1357.77|2835|8.96|2,1|-9000
30|Zn|Zinc|65.38|transition|12|4|1.65|692.68|1180|7.14|2|1746
31|Ga|Gallium|69.723|post|13|4|1.81|302.91|2673|5.91|3|1875
32|Ge|Germanium|72.630|metalloid|14|4|2.01|1211.4|3106|5.323|4|1886
33|As|Arsenic|74.922|metalloid|15|4|2.18|1090|887|5.727|3,5,-3|1250
34|Se|Selenium|78.971|nonmetal|16|4|2.55|494|958|4.81|-2,4,6|1817
35|Br|Bromine|79.904|halogen|17|4|2.96|265.8|332.0|3.1028|-1,1,5|1826
36|Kr|Krypton|83.798|noble|18|4|3.00|115.79|119.93|0.003733|0|1898
37|Rb|Rubidium|85.468|alkali|1|5|0.82|312.46|961|1.532|1|1861
38|Sr|Strontium|87.62|alkaline|2|5|0.95|1050|1655|2.64|2|1787
39|Y|Yttrium|88.906|transition|3|5|1.22|1799|3609|4.472|3|1794
40|Zr|Zirconium|91.224|transition|4|5|1.33|2128|4682|6.52|4|1789
41|Nb|Niobium|92.906|transition|5|5|1.60|2750|5017|8.57|5,3|1801
42|Mo|Molybdenum|95.95|transition|6|5|2.16|2896|4912|10.28|6,4|1781
43|Tc|Technetium|98|transition|7|5|1.90|2430|4538|11.0|7|1937
44|Ru|Ruthenium|101.07|transition|8|5|2.20|2607|4423|12.45|4,3|1844
45|Rh|Rhodium|102.91|transition|9|5|2.28|2237|3968|12.41|3|1804
46|Pd|Palladium|106.42|transition|10|5|2.20|1828.05|3236|12.023|2,4|1803
47|Ag|Silver|107.87|transition|11|5|1.93|1234.93|2435|10.49|1|-5000
48|Cd|Cadmium|112.41|transition|12|5|1.69|594.22|1040|8.65|2|1817
49|In|Indium|114.82|post|13|5|1.78|429.75|2345|7.31|3|1863
50|Sn|Tin|118.71|post|14|5|1.96|505.08|2875|7.287|4,2|-3500
51|Sb|Antimony|121.76|metalloid|15|5|2.05|903.78|1860|6.685|3,5,-3|-3000
52|Te|Tellurium|127.60|metalloid|16|5|2.10|722.66|1261|6.232|-2,4,6|1782
53|I|Iodine|126.90|halogen|17|5|2.66|386.85|457.4|4.933|-1,1,5,7|1811
54|Xe|Xenon|131.29|noble|18|5|2.60|161.4|165.03|0.005887|0|1898
55|Cs|Caesium|132.91|alkali|1|6|0.79|301.7|944|1.93|1|1860
56|Ba|Barium|137.33|alkaline|2|6|0.89|1000|2170|3.51|2|1772
57|La|Lanthanum|138.91|lanthanide|3|6|1.10|1193|3737|6.162|3|1839
58|Ce|Cerium|140.12|lanthanide||6|1.12|1068|3716|6.770|3,4|1803
59|Pr|Praseodymium|140.91|lanthanide||6|1.13|1208|3793|6.77|3|1885
60|Nd|Neodymium|144.24|lanthanide||6|1.14|1297|3347|7.01|3|1885
61|Pm|Promethium|145|lanthanide||6|1.13|1315|3273|7.26|3|1945
62|Sm|Samarium|150.36|lanthanide||6|1.17|1345|2067|7.52|3,2|1879
63|Eu|Europium|151.96|lanthanide||6|1.20|1099|1802|5.244|3,2|1901
64|Gd|Gadolinium|157.25|lanthanide||6|1.20|1585|3546|7.90|3|1880
65|Tb|Terbium|158.93|lanthanide||6|1.20|1629|3503|8.23|3|1843
66|Dy|Dysprosium|162.50|lanthanide||6|1.22|1680|2840|8.540|3|1886
67|Ho|Holmium|164.93|lanthanide||6|1.23|1734|2993|8.79|3|1878
68|Er|Erbium|167.26|lanthanide||6|1.24|1802|3141|9.066|3|1843
69|Tm|Thulium|168.93|lanthanide||6|1.25|1818|2223|9.32|3|1879
70|Yb|Ytterbium|173.05|lanthanide||6|1.10|1097|1469|6.90|3,2|1878
71|Lu|Lutetium|174.97|lanthanide||6|1.27|1925|3675|9.841|3|1907
72|Hf|Hafnium|178.49|transition|4|6|1.30|2506|4876|13.31|4|1923
73|Ta|Tantalum|180.95|transition|5|6|1.50|3290|5731|16.69|5|1802
74|W|Tungsten|183.84|transition|6|6|2.36|3695|5828|19.25|6|1781
75|Re|Rhenium|186.21|transition|7|6|1.90|3459|5869|21.02|4,7|1925
76|Os|Osmium|190.23|transition|8|6|2.20|3306|5285|22.59|4|1803
77|Ir|Iridium|192.22|transition|9|6|2.20|2719|4701|22.56|4,3|1803
78|Pt|Platinum|195.08|transition|10|6|2.28|2041.4|4098|21.45|4,2|1735
79|Au|Gold|196.97|transition|11|6|2.54|1337.33|3129|19.30|3,1|-6000
80|Hg|Mercury|200.59|transition|12|6|2.00|234.32|629.88|13.534|2,1|-1500
81|Tl|Thallium|204.38|post|13|6|1.62|577|1746|11.85|1,3|1861
82|Pb|Lead|207.2|post|14|6|2.33|600.61|2022|11.34|2,4|-7000
83|Bi|Bismuth|208.98|post|15|6|2.02|544.7|1837|9.78|3,5|1400
84|Po|Polonium|209|post|16|6|2.00|527|1235|9.196|4,2|1898
85|At|Astatine|210|metalloid|17|6|2.20|575|610|7.0|-1,1|1940
86|Rn|Radon|222|noble|18|6|2.20|202|211.5|0.00973|0|1900
87|Fr|Francium|223|alkali|1|7|0.70|300|950|1.87|1|1939
88|Ra|Radium|226|alkaline|2|7|0.90|973|2010|5.5|2|1898
89|Ac|Actinium|227|actinide|3|7|1.10|1323|3471|10.07|3|1899
90|Th|Thorium|232.04|actinide||7|1.30|2115|5061|11.72|4|1829
91|Pa|Protactinium|231.04|actinide||7|1.50|1841|4300|15.37|5,4|1913
92|U|Uranium|238.03|actinide||7|1.38|1405.3|4404|19.10|6,4|1789
93|Np|Neptunium|237|actinide||7|1.36|917|4273|20.45|5|1940
94|Pu|Plutonium|244|actinide||7|1.28|912.5|3501|19.816|4|1940
95|Am|Americium|243|actinide||7|1.30|1449|2880|12.0|3|1944
96|Cm|Curium|247|actinide||7|1.30|1613|3383|13.51|3|1944
97|Bk|Berkelium|247|actinide||7|1.30|1259|2900|14.78|3|1949
98|Cf|Californium|251|actinide||7|1.30|1173|1743|15.1|3|1950
99|Es|Einsteinium|252|actinide||7|1.30|1133|1269|8.84|3|1952
100|Fm|Fermium|257|actinide||7|1.30|1800||9.7|3|1952
101|Md|Mendelevium|258|actinide||7|1.30|1100||10.3|3|1955
102|No|Nobelium|259|actinide||7|1.30|1100||9.9|2,3|1966
103|Lr|Lawrencium|266|actinide||7|1.30|1900||15.6|3|1961
104|Rf|Rutherfordium|267|transition|4|7||2400|5800|23.2|4|1964
105|Db|Dubnium|268|transition|5|7||||29.3|5|1967
106|Sg|Seaborgium|269|transition|6|7||||35.0|6|1974
107|Bh|Bohrium|270|transition|7|7||||37.1|7|1981
108|Hs|Hassium|269|transition|8|7||||40.7|8|1984
109|Mt|Meitnerium|278|unknown|9|7||||37.4||1982
110|Ds|Darmstadtium|281|unknown|10|7||||34.8||1994
111|Rg|Roentgenium|282|unknown|11|7||||28.7||1994
112|Cn|Copernicium|285|unknown|12|7||||14.0|2|1996
113|Nh|Nihonium|286|unknown|13|7||||16.0||2003
114|Fl|Flerovium|289|unknown|14|7||||14.0||1998
115|Mc|Moscovium|290|unknown|15|7||||13.5||2003
116|Lv|Livermorium|293|unknown|16|7||||12.9||2000
117|Ts|Tennessine|294|unknown|17|7||||7.2||2010
118|Og|Oganesson|294|unknown|18|7||||5.0||2002
`.trim();

/* ---- electron configuration, built from the Madelung order + known exceptions ---- */
const ORBITALS = [
  ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10],
  ['4p', 6], ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10],
  ['6p', 6], ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6]
];

// Real ground states that disobey the filling order.
const CONFIG_EXCEPTIONS = {
  24: '[Ar]3d5 4s1', 29: '[Ar]3d10 4s1',
  41: '[Kr]4d4 5s1', 42: '[Kr]4d5 5s1', 44: '[Kr]4d7 5s1', 45: '[Kr]4d8 5s1',
  46: '[Kr]4d10', 47: '[Kr]4d10 5s1', 57: '[Xe]5d1 6s2', 58: '[Xe]4f1 5d1 6s2',
  64: '[Xe]4f7 5d1 6s2', 78: '[Xe]4f14 5d9 6s1', 79: '[Xe]4f14 5d10 6s1',
  89: '[Rn]6d1 7s2', 90: '[Rn]6d2 7s2', 91: '[Rn]5f2 6d1 7s2',
  92: '[Rn]5f3 6d1 7s2', 93: '[Rn]5f4 6d1 7s2', 96: '[Rn]5f7 6d1 7s2',
  103: '[Rn]5f14 7s2 7p1'
};

const NOBLE = [[86, 'Rn'], [54, 'Xe'], [36, 'Kr'], [18, 'Ar'], [10, 'Ne'], [2, 'He']];

function fillOrbitals(z) {
  let left = z;
  const out = [];
  for (const [name, cap] of ORBITALS) {
    if (left <= 0) break;
    const n = Math.min(cap, left);
    out.push([name, n]);
    left -= n;
  }
  return out;
}

// Shell occupancies (K, L, M, ...) read off the resolved configuration,
// so the ground-state exceptions come out right too.
function shellCounts(config) {
  const shells = [];
  const add = (n, c) => { shells[n - 1] = (shells[n - 1] || 0) + c; };
  const expand = s => {
    const core = s.match(/^\[(\w+)\]/);
    if (!core) return s;
    const z = NOBLE.find(([, sym]) => sym === core[1])[0];
    return expand(configFor(z)) + ' ' + s.slice(core[0].length);
  };
  for (const m of expand(config).matchAll(/(\d)([spdf])(\d+)/g)) add(+m[1], +m[3]);
  return Array.from(shells, v => v || 0);
}

function configFor(z) {
  if (CONFIG_EXCEPTIONS[z]) return CONFIG_EXCEPTIONS[z];
  const filled = fillOrbitals(z);
  let core = '', start = 0;
  for (const [nz, sym] of NOBLE) {
    if (nz < z) {
      const consumed = fillOrbitals(nz).length;
      core = `[${sym}]`;
      start = consumed;
      break;
    }
  }
  const L = { s: 0, p: 1, d: 2, f: 3 };
  const tail = filled.slice(start)
    .sort((a, b) => (+a[0][0] - +b[0][0]) || (L[a[0][1]] - L[b[0][1]]))
    .map(([n, c]) => `${n}${c}`).join(' ');
  return (core + tail).trim();
}

function blockOf(group, period, z) {
  if ((z >= 58 && z <= 71) || (z >= 90 && z <= 103)) return 'f';
  if (z === 2) return 's';
  if (group === 1 || group === 2) return 's';
  if (group >= 13) return 'p';
  return 'd';
}

/* ---- assemble ---- */
const num = v => (v === '' || v == null ? null : Number(v));

const ELEMENTS = RAW.split('\n').map(line => {
  const f = line.split('|');
  const z = +f[0];
  const group = num(f[5]);
  const period = +f[6];
  const el = {
    z,
    symbol: f[1],
    name: f[2],
    mass: +f[3],
    category: f[4],
    group,
    period,
    block: blockOf(group, period, z),
    en: num(f[7]),
    melt: num(f[8]),
    boil: num(f[9]),
    density: num(f[10]),
    oxidation: f[11] ? f[11].split(',').map(Number) : [],
    year: num(f[12])
  };
  el.config = configFor(z);
  el.shells = shellCounts(el.config);
  el.radioactive = z >= 84 || z === 43 || z === 61;
  el.synthetic = z >= 95 || z === 43 || z === 61 || z === 93 || z === 94 || z === 85 || z === 87;
  el.metallic = ['alkali', 'alkaline', 'transition', 'post', 'lanthanide', 'actinide'].includes(el.category)
    ? 'metal' : el.category === 'metalloid' ? 'metalloid' : 'nonmetal';
  // Where the classic chart actually draws it.
  el.col = group || (z >= 58 && z <= 71 ? z - 55 : z - 87);
  el.row = (z >= 58 && z <= 71) ? 9 : (z >= 90 && z <= 103) ? 10 : period;
  return el;
});

const BY_Z = Object.fromEntries(ELEMENTS.map(e => [e.z, e]));

const CATEGORIES = {
  alkali:     { label: 'Alkali metal',        color: '#B4552D' },
  alkaline:   { label: 'Alkaline earth',      color: '#C58A21' },
  transition: { label: 'Transition metal',    color: '#5E7F52' },
  post:       { label: 'Post-transition',     color: '#3F7A76' },
  metalloid:  { label: 'Metalloid',           color: '#7A6AA3' },
  nonmetal:   { label: 'Reactive nonmetal',   color: '#2F5D7C' },
  halogen:    { label: 'Halogen',             color: '#8E3F63' },
  noble:      { label: 'Noble gas',           color: '#8A6B3D' },
  lanthanide: { label: 'Lanthanide',          color: '#9C6540' },
  actinide:   { label: 'Actinide',            color: '#6E7B8B' },
  unknown:    { label: 'Predicted properties',color: '#98A0A6' }
};

// Phase at a given temperature in kelvin.
function phaseAt(el, T) {
  if (el.melt == null) return 'unknown';
  if (T < el.melt) return 'solid';
  if (el.boil == null) return 'liquid';
  return T < el.boil ? 'liquid' : 'gas';
}
