/* Store playing states
	lb: Last Book to be played
	"1": Chứa các thông tin về sách số 1, theo selectedIndex của dropdown list của sách elmDrpdwnBook
		lc: Last chapter, Last chapter to be played, theo selectedIndex của dropdown list của Chương elmDrpdwnChapter
		"3": "12.25" Chương số 3 đang được chơi đến phút 12.25
		chapGrpCollapse {array}: only book that has chapter group has this property on xState, which store index (of book.tap array) all 'chapter groups' that are currently collapsed
		
	grpCfg: list of json store setting for group type, there is one json for each group way in xBookGrp. Each item in following Format and look like:
		{ "grpLine": 0, "grpWay": "Nhóm theo Bộ truyện", "grp": []).
		Each item of "grp" will store setting for one sub-group (or category) looks like: {gId: '$6', label: 'The Lord of the Rings', bHidden: false} Where:
			gId {string}  : id of this book set in this group way
			label {string}: name of book Set
			bHidden {boolean}: this book set is hidden (=true) or shown (=false) 
		Note that xBookGrp is NOT saved after each browser session, only xState is, so grpCfg will stored all user-setting on book set, book kit, book group confiuration and that is restored back to xBookGrp at the beginning of next session.
	
	depressToastFlag: flag used as global variable which is used to depress the Toast notification from displaying
*/
var xState = {
  "grpLine": 0, //order to sort book, 0 - by MC + published year, 1: by published year. See the grp property in xData
  "disableCircleProgressButton" : false, //to disable (if =true) audio playing circle progress on PlayPause button 
  "hideBufferBar" : false, //to show/hide buffer bar right below progress bar
  "sp": 2.0, //speed
  "lb": 1, //last book (sách stt từ 1)
  "1": {
    "3": 0.0, //time (in second) to stop last play of book value 1 and chapter value 3
    "lc": 1 //last chapter (chương sách lấy stt từ 1)
  },
  "history" : {
	  "currHis" : 0, // index of current book in hisList
	  "histCallFlag" : false, // if go from History, turn this flag on so the book will not be put on top of History List
	  "hisList":[] //the list of books has been readingm store the stt of book in xData
  }
};

const wildCartStr = "<*~~*>";

/* bookKitInfor: contains information about a Book Kit.
Most Book Kit has only one Book Set such as 'The Lord of the Rings', 'A Song of Ice and Fire', 'Harry Potter', 'Tây Du Ký',...
But some others has more than one Book Set, for example Book Kit "Sherlock Holmes" has 3 book sets: 'Sherlock Holmes - Tiểu thuyết', 'Sherlock Holmes - Tuyển tập truyện ngắn', 'Sherlock Holmes - Truyện khác'. Book Kit "The Witcher" has 2 book sets: 'The Witcher - Tuyển tập truyện ngắn', 'The Witcher - Saga'

Each Book Set would contains one or more books.
bookKitInfor is array of items, each item has information for a Book Kit, may looks like:
	{bkIdx: 0, startIdx: 0, endIdx: 21, label: 'Sherlock Holmes'}
		bkIdx				{number}: index in bookKitInfor array
		startIdx, endIdx	{number}: start and end index of items in xData that belong to this book kit
		Label				{string}: Book Kit name
		grpRanks			{array}: each item of this array look like: "{bsCount: 5, rank: 0, bsHidden: 4}" where:
			- bsCount {integer}: number of book set belong to this book kit
			- rank {integer}: the rank of this book kit for a group way in xBookGrp. 
			- bsHidden {integer}: count number of hidden book set of this book kit
			For now, xBookGrp has 3 items so grpRanks has 3 items, too. The rank of a book kit would change when user re-arrange its book set(s).			
*/
bookKitInfor = null;

/* xBookGrp is array to define how to group Book Set in different way, each item is one way to group. The specification to group book for each book kit is in {meta} property of each book kit, its will be merge into {grp} property of xBookGrp item. After being merged, each item has following information
	grpWay {string}: Name of Type (way) of group
	grp: array, each item define a Book Set
		label: 	name of Book Set
		gId:	Id of the book set
			In BookData.prepareData() function, following attributes are added into "grp" property of each xBookGrp item
		bookKit: index of Book Kit (of which this Book Set belongs to) in bookKitInfor array.
		books: an array of book in this book set, this is an array, in which each item like following
			{bId: 'LOTR.TAP0', bName: 'The Hobbit: Or There and Back Again', mc: 'Rin Mabuko', year: 1937, bList: Array(1)}
				bId: Id of the book defined in "grp" of each book in xData
				bName, mc, year: name,mc,year of the book - these extra information are redundant, for convenience when updating UI
				bList: list of this book but read by different MC
*/	
const xBookGrp = [
  {"grpWay": "Nhóm theo Bộ truyện"    , "grp": []},
  {"grpWay": "Sắp xếp theo Người đọc" , "grp": []},
  {"grpWay": "Sắp xếp theo Tên truyện", "grp": []}
];

/*Format:
- stt: được thêm khi trang Web bắt đầu chạy, dùng để lưu vị trí index của sách trong xData giúp có thể lấy dữ liệu chính xác của sách trong các cách sắp xếp sách khác nhau
- title: name of the book
- eTitle: tên tiếng Anh của sách
- type: type  of the book
- mc: Người đọc
- cover: bìa Sách or chapter cover
- grp: array of which, each item is group id to group books into category which in turn defined in xBookGrp variable. So grp.length === xBookGrp.lenght
- wc : Stands for WildCart. Lots of links (especially from Archieve.org) that similar between chapters, only different in the number of chapter ordernal. To save storage of this data files, we can auto-generate the url for those chapters links. That is the goal of this property. "wc" is array of JSON, each has:
	"urlLine": the line - the index of parts.url of the link that need wildcart
	"nd": number of digits that need to replace into wildcart
	"wcSrc": the original source with the wildcart, default is "<*~~*>", the chapter ordernal will replace this wildcart to have real url
	NOTE:	+ If a chapter does NOT have link at some line (e.g line 1) having wildcart, the url in that line need to set to null, i.e. parts[$chapter number$].url[1]=null
			+ When making real links from wildcart, the page will create a new varicable named wcDone to know if we already created links before, do not have to create again
- ssrc: nguồn lấy audio, có thể là string nếu 1 nguồn, nếu nhiều nguồn thì là Array 
- year: Năm xuất bản
- tap: devide book into chapter groups (or parts), is Array of json item, each item looks like: {"label": "Phần 2: Vùng đất của các vị thánh (The country of the Saints)", "f": 5, "t": 6}, where:
	label {string}	: name of the chapter group
	f,t {integer}	: this group contains chapter from stt {f} to stt {t}. Aware that it is stt (=index+1), not index
- intro: Giới thiệu về cuốn Sách
- parts: thông tin cụ thể về các chương, là Array của json theo format:
	stt: stt
	cId: id của chương, đánh theo id sách + stt của chương
	year: năm chương được viết
	tit: tên chương
	url: link đến file mp3, có thể là string (nếu chỉ có 1 link) hoặc array của các link. In the case there is wc setting (see above) for urls, the js code will generate full url from wildcart, with following cases (see changeBook() function):
		- url[urlLine] == null (an item of url array is null): meaning there is no audio link for this urlLine, it will be taken out of url array
		- url (string) or url[urlLine] == "": js code will use chapter stt (which is chapter index + 1) to make full audio link from WildCart
		- url (string) or url[urlLine] == un-empty string but not a full url string: js code use this un-empty string to fill in the wildcart
		- url (string) or url[urlLine] == full url string: js code do nothing, just use the full link to play
		
	dur: duration của chương (dùng chung cho tất cả các link mp3 nếu có nhiều link)
	img: cover của chương (nếu có)
	oUrl: link ngoài đến file của chương (nếu có)
	eTit: tên tiếng Anh
	infor: information about the chapter. Basically, only chapters of collection book which have no bond-ralation with each other has this property
- wcDone: flag created by js code to mark that full links for url, img, oUrl,... have been filled using wildcart 
*/
const shData = {
"meta" : {
	"name" : "Sherlock Holmes",
	"eName" : "Sherlock Holmes",
	"bookGrp" : [
		[
			{"label": "Sherlock Holmes - Tiểu thuyết" , "gId" : "$1"},
			{"label": "Sherlock Holmes - Tuyển tập truyện ngắn", "gId": "$2"},
			{"label": "Sherlock Holmes - Truyện khác" , "gId": "$3"}],
		[
			{"label": "VTC Now - SH Tiểu thuyết" , "gId" : "SH.VTC-TT"},
			{"label": "VTC Now - SH Tuyển tập truyện ngắn", "gId": "SH.VTC-TN"},
			{"label": "TDP124 - SH Tiểu thuyết" , "gId": "SH.TDP124-TT"},
			{"label": "TDP124 - SH Tuyển tập truyện ngắn" , "gId": "SH.TDP124-TN"},
			{"label": "Người đọc khác - Sherlock Holmes", "gId": "SH.OTHERS"}
		],
		[
			{"label": "[1887] SH - A Study in Scarlet" , "gId" : "SH.A1"},
			{"label": "[1890] SH - The Sign of the Four" , "gId" : "SH.A2"},
			{"label": "[1902] SH - The Hound of the Baskervilles" , "gId" : "SH.A3"},
			{"label": "[1914] SH - The Valley of Fear" , "gId" : "SH.A4"},
			{"label": "[1892] SH - The Adventures of Sherlock Holmes" , "gId" : "SH.B"},
			{"label": "[1893] SH - Memoirs of Sherlock Holmes" , "gId" : "SH.C"},
			{"label": "[1904] SH - The Return of Sherlock Holmes" , "gId" : "SH.D"},
			{"label": "[1917] SH - His Last Bow" , "gId" : "SH.E"},
			{"label": "[1927] SH - The Case Book of Sherlock Holmes" , "gId" : "SH.F"},
			{"label": "SH - Other Collection" , "gId" : "SH.G"}
		]
	]
},
"books": [
  {
    "title": "Chiếc nhẫn tình cờ",
    "eTitle": "A Study in Scarlet",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Hùng Sơn",
    "cover": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/ArthurConanDoyle_AStudyInScarlet_annual.jpg/440px-ArthurConanDoyle_AStudyInScarlet_annual.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/chiec-nhan-tinh-co#fwdrapPlayer0?catid=10&trackid=0",
      "https://archive.org/details/chiec-nhan-tinh-co-kenhsachnoi.com",
      "https://www.youtube.com/playlist?list=PLBLp8ljAjGVo4mx-3vTchU5HX-Nf8QajJ",
      "https://www.youtube.com/playlist?list=PLqF-ROaM3XkPwOH5ti5kr8Ai-RsxzkpKq"
    ],
    "grp": ["SH.A1$1", "SH.VTC-TT", "SH.A1"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/chiec-nhan-tinh-co-kenhsachnoi.com/<*~~*>-Chiec-Nhan-Tinh-Co-(KenhSachNoi.Com).mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "year": "1887",
    "tap": [
      {"label": "Phần I. Hồi ức của bác sĩ Watson (The Reminiscences of John H. Watson)" , "f": 1, "t": 4},
      {"label": "Phần 2: Vùng đất của các vị thánh (The country of the Saints)", "f": 5, "t": 6}
    ],
    "intro": "Tác phẩm được viết năm 1887, là câu chuyện đầu tiên xuất hiện nhân vật Sherlock Holmes và John H. Watson. Tác phẩm này đánh dấu sự ra đời của nhân vật nổi tiếng nhất trong văn học trinh thám Sherlock Holmes. Tác phẩm được xuất bản năm 1887. Đây là một trong 4 tiểu thuyết viết về Sherlock Holmes của Conan Doyle. Tác phẩm có tên là <b>Cuộc điều tra màu đỏ</b> (Tiếng Anh: Study in Scarlet ) là vì một câu nói của Sherlock Holmes ở chương IV 'John Rance tìm thấy gì?' với bác sĩ Watson, ông ấy đã miêu tả cuộc điều tra mà mình đang thực hiện là 'Cuộc điều tra màu đỏ': 'Có 1 sợi chỉ màu đỏ của án mạng luồn lách trong sợi chỉ không màu của cuộc sống. Và nhiệm vụ của chúng ta là tháo gỡ nó, cô lập nó và bóc trần mọi mặt của nó'. Nhưng một số nhà xuất bản ở Việt Nam đã tự ý lược bỏ phần này và dịch lại với tên <b>Chiếc nhẫn tình cờ</b>.",
    "parts": [
      {
        "stt": 1,
        "tit": "Ch 1. Làm quen với Sherlock Holmes - Ch 2. Suy đoán, một môn khoa học",
        "url": [""],
        "img": "ai5RXkk1z5s",
        "dur": "25:35",
		"eTit": "Part I: Chapter 1. Mr. Sherlock Holmes + Chapter 2. The science of deduction."
      },
      {
        "stt": 2,
        "tit": "Ch 3. Bí ẩn ở Lauriston Garden - Ch 4. Lời khai của cảnh sát John Rance",
        "url": [""],
        "img": "5PNQK6z748U",
        "dur": "30:12",
		"eTit": "Part I: Chapter 3. The Lauriston Gardens mystery + Chapter 4 . What John Rance had to tell."
      },
      {
        "stt": 3,
        "tit": "Ch 5. Cuộc viếng thăm của người khách lạ - Ch 6. Gregson tìm thấy gì",
        "url": [""],
        "img": "CoO0r9W_Ngk",
        "dur": "25:36",
		"eTit": "Part I: Chapter 5. Our advertisement brings a visitor + Chapter 6. Tobias Gregson shows what he can do."
      },
      {
        "stt": 4,
        "tit": "Ch 7. Một tia sáng trong đêm tối - Ch 8. Bình nguyên chết",
        "url": [""],
        "img": "hEUGZAyI_C0",
        "dur": "30:22",
		"eTit": "Chapter 7 (Part I). Light in the darkness + Chapter 1 (Part II). On the great Alkali plain."
      },
      {
        "stt": 5,
        "tit": "Ch 9. Bông hoa Utah - Ch10. Chạy trốn - Ch 11. Báo oán",
        "url": [""],
        "img": "kPD0o9SPSRA",
        "dur": "36:45",
		"eTit": "Part II: Chapter 2. The flower of Utah + Chapter 3. A flight for life + Chapter 4. The avenging angels."
      },
      {
        "stt": 6,
        "tit": "Ch 12. Phần tiếp trong nhật ký của bác sĩ Watson - Ch 13. Kết thúc",
        "url": [""],
        "img": "MHEn0sCHJOY",
        "dur": "26:44",
		"eTit": "Part II: Chapter 5. A continuation of the reminiscences of John Watson, M.D + Chapter 6. The conclusion."
      }
    ]
  },
  {
    "title": "Truy tìm Dấu Bộ Tứ",
    "eTitle": "The Sign of Four",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Hùng Sơn",
    "cover": "https://i0.wp.com/sachnoiviet.net/wp-content/uploads/2022/05/truy-tim-dau-bo-tu.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/theo-dau-bo-tu-mc-hung-son#/fwdrapPlayer0?catid=26&trackid=8",
      "https://archive.org/details/kenhsachnoi.com-dau-bo-tu/",
      "https://sachnoiviet.net/sach-noi/truy-tim-dau-bo-tu",
      "https://archive.org/details/tieu-thuyet-sherlock-holmes-truy-tim-dau-bo-tu.sna",
      "https://www.youtube.com/playlist?list=PLBLp8ljAjGVp9ZpB_WqfwTJBBvsZhfKh2",
      "https://www.youtube.com/playlist?list=PLqF-ROaM3XkPwOH5ti5kr8Ai-RsxzkpKq"
    ],
    "grp": ["SH.A2$1", "SH.VTC-TT", "SH.A2"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-dau-bo-tu/<*~~*>-Dau-Bo-Tu_(KenhSachNoi.Com).mp3"
        },
		{
          "urlLine": 1,
          "nd": -1,
          "wcSrc": "https://archive.org/download/tieu-thuyet-sherlock-holmes-truy-tim-dau-bo-tu.sna/<*~~*>"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "year": "1890",
    "intro": "<b>Dấu Bộ Tứ</b> (Tiếng Anh: The Sign of Four) được giới thiệu là một trong những tiểu thuyết hay nhất từ tác giả Sir Arthur Conan Doyle. Tựa đề ban đầu của tác phẩm là <i>The Sign of the Four</i>, và đây là tác phẩm tuyệt vời thứ hai trong loạt truyện về thám tử Sherlock Holmes của Sir Arthur Conan Doyle.<br/>Tại một bữa tiệc tại khách sạn Langham vào mùa hè năm 1889, một quản lý biên tập của tạp chí American Lippincott đã có cơ hội gặp gỡ với các tác giả nổi tiếng như Oscar Wilde và Arthur Conan Doyle. Tại buổi tiệc đặc biệt này, hai tác phẩm đặc sắc đã được giới thiệu: 'Dorian Gray' của Oscar Wilde và tác phẩm mới về Sherlock Holmes của Conan Doyle, ban đầu có tựa đề <i>The Sign of the Four</i> (Dấu của Bốn Người).<br/>Tác phẩm này lấy cảm hứng từ sự thành công của tác phẩm trước đó, <i>Cuộc điều tra màu đỏ</i> (A Study in Scarlet), và kể về một câu chuyện phức tạp liên quan đến Mary Morstan, con gái của một chỉ huy quân đội Ấn Độ đã mất tích. Mary Morstan gặp Sherlock Holmes và tiết lộ rằng cô đã nhận được sáu viên ngọc trai hàng năm vào ngày 7 tháng 7 từ một nguồn gửi không rõ danh tính.<br/>Cô chỉ có một manh mối duy nhất: một bản đồ của một pháo đài và tên ba người theo đạo Sikhs cùng với Jonathan Small. Điều này đánh dấu sự bắt đầu của cuộc phiêu lưu thú vị và kịch tính trong tác phẩm này.",
    "parts": [
      {
        "stt": 1,
        "tit": "Ch 1. Trình bày nội vụ - Ch 2. Đi tìm một giải pháp",
        "url": [
          "", "01. Trình bày nội vụ - Đi tìm một giải pháp.mp3"
        ],
        "img": "KJM1LfofDu8",
        "dur": "20:00",
		"eTit" : "Chapter II. The statement of the case + Chapter III. In quest of a solution"
      },
      {
        "stt": 2,
        "tit": "Ch 3. Câu chuyện của người hói đầu",
        "url": [
          "","02. Câu chuyện của người hói đầu.mp3"
        ],
        "img": "3OqurCOeJ3U",
        "dur": "18:17",
		"eTit" : "Chapter IV. The story of the bald-headed man"
      },
      {
        "stt": 3,
        "tit": "Ch 4. Tấm thảm kịch ở biệt trang Pondicherry",
        "url": [
          "","03. Tấm thảm kịch ở biệt trang Pondicherry.mp3"
        ],
        "img": "BgDh2vfH7L4",
        "dur": "13:19",
		"eTit" : "Chapter V. The tragedy of Pondicherry Lodge"
      },
      {
        "stt": 4,
        "tit": "Ch 5. Sherlock Holmes bắt đầu diễn giảng",
        "url": [
          "", "04. Sherlock Holmes bắt đầu diễn giảng.mp3"
        ],
        "img": "v1362INqY38",
        "dur": "15:58",
		"eTit" : "Chapter VI. Sherlock Holmes gives a demonstration"
      },
      {
        "stt": 5,
        "tit": "Ch 6. Câu chuyện chiếc thùng tô-nô",
        "url": [
          "", "05. Câu chuyện chiếc thùng tô-nô.mp3"
        ],
        "img": "jXxi0wc7ghQ",
        "dur": "20:32",
		"eTit" : "Chapter VII. The episode of the barrel"
      },
      {
        "stt": 6,
        "tit": "Ch 7. Nghĩa binh ở phố Baker",
        "url": [
          "", "06. Nghĩa binh ở phố Baker.mp3"
        ],
        "img": "c6cK8QwzJrw",
        "dur": "18:02",
		"eTit" : "Chapter VIII. The Baker street irregulars"
      },
      {
        "stt": 7,
        "tit": "Ch 8. Sợi dây xích đứt",
        "url": [
          "", "07. Sợi dây xích đứt.mp3"
        ],
        "img": "-w8FN97nA2c",
        "dur": "17:52",
		"eTit" : "Chapter IX. A break in the chain"
      },
      {
        "stt": 8,
        "tit": "Ch 9. Hết đời tên dân đảo - Ch 10. Kho báu to lớn từ Agra",
        "url": [
          "", "08. Hết đời tên dân đảo - Kho báu to lớn từ Agra.mp3"
        ],
        "img": "6-Ur_wHddb0",
        "dur": "25:12",
		"eTit" : "Chapter X. The end of the islander + Chapter XI. The great Agra treasure"
      },
      {
        "stt": 9,
        "tit": "Ch 11. Câu chuyện kì lạ của Jonathan Small",
        "url": [
          "", "https://archive.org/download/y-2mate.com-sherlock-holmes-truy-tim-dau-bo-tu-99-vtc-sach-hay/y2mate.com - Sherlock Holmes  Truy tìm dấu bộ tứ  99   VTC Sách hay.mp3"
        ],
        "img": "IfekutHMteQ",
        "dur": "31:13",
		"eTit" : "Chapter XII. The strange story of Jonathan Small"
      }
    ]
  },
  {
    "title": "Con chó săn của dòng họ Baskervilles",
    "eTitle": "The Hound of the Baskervilles",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Hùng Sơn",
    "cover": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEheOsJ1XEz6JxdscE6p1eJBgJKkKEERDXw87ZD_x1u4KPDvgPJ_ux5hNOrNw3MGvs-g4ItsKuvLg9hsoP7ghuYh4Ago0wdOxqEGJTN4iyNayh391eC2DORxu81LbQrJCKPbMPPfT3fdX8I/s1600/con_cho_cua_dong_ho_baskerville__sir_arthur_conan_doyle.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/con-cho-cua-dong-ho-baskerviller#fwdrapPlayer0?catid=9&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-con-cho-cua-dong-ho-baskerville/",
      "https://www.youtube.com/playlist?list=PLBLp8ljAjGVr-gPg-cJLkMnFdaNhmKBfl",
      "https://www.youtube.com/playlist?list=PLqF-ROaM3XkPwOH5ti5kr8Ai-RsxzkpKq"
    ],
    "grp": ["SH.A3$1", "SH.VTC-TT", "SH.A3"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-con-cho-cua-dong-ho-baskerville/<*~~*> -Con-Cho-Cua-Dong-Ho-Baskerville-(KenhSachNoi.Com).mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "year": "1901-1902",
    "intro": "<b>Con chó săn của dòng họ Baskerville</b> (tiếng Anh: The hound of the Baskervilles) là bộ thứ ba trong bốn cuốn tiểu thuyết tội phạm được Sir Arthur Conan Doyle sáng tác có sự tham gia của thám tử Sherlock Holmes.<br/>Ban đầu phần này được đăng trên Tạp chí Strand từ tháng 8 năm 1901 đến tháng 4 năm 1902, phần lớn lấy bối cảnh ở Dartmoor ở Devon ở miền Tây nước Anh. Câu chuyện kể về một vụ âm mưu giết người lấy cảm hứng từ truyền thuyết về một con chó săn đáng sợ, có nguồn gốc siêu nhiên. Sherlock Holmes và bạn đồng hành Bác sĩ Watson thực hiện điều tra vụ án. Đây là lần xuất hiện đầu tiên của Holmes kể từ sau sự kiện mô tả rằng ông đã chết trong truyện 'Công việc cuối cùng của Sherlock Holmes' và thành công của tác phẩm Con chó săn của dòng họ Baskerville đã dẫn đến sự hồi sinh trở lại của nhân vật.<br/>Là một trong những câu chuyện nổi tiếng nhất từng được viết, vào năm 2003, cuốn sách được liệt kê ở vị trí 128 của 200 <i>tiểu thuyết được yêu thích nhất</i> trên cuộc thăm dò toàn nước Anh Big Read của BBC. Năm 1999, nó được liệt kê là tiểu thuyết Holmes hàng đầu, với một đánh giá hoàn hảo 100/100 điểm từ các học giả nghiên cứu Sherlock Holmes.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Ông Sherlock Homes",
		"url": [""],
		"img": "Na1vgyed8F0",
		"dur": "11:17",
		"cId": "A3.1",
		"eTit": "Chapter 1 — Mr. Sherlock Holmes"
	  },
	  {
		"stt": 2,
		"tit": "Nỗi Bất Hạnh Của Dòng Họ Baskerville",
		"url": [""],
		"img": "z1jVPMUZLEQ",
		"dur": "17:00",
		"cId": "A3.2",
		"eTit": "Chapter 2 — The curse of the Baskervilles"
	  },
	  {
		"stt": 3,
		"tit": "Điểm Mấu Chốt",
		"url": [""],
		"img": "DCCz4-z1iUc",
		"dur": "14:35",
		"cId": "A3.3",
		"eTit": "Chapter 3 — The problem"
	  },
	  {
		"stt": 4,
		"tit": "Ngài Henry Baskerville",
		"url": [""],
		"img": "jJHr6XX1CIc",
		"dur": "20:07",
		"cId": "A3.4",
		"eTit": "Chapter 4 — Sir. Henry Baskerville"
	  },
	  {
		"stt": 5,
		"tit": "Ba Sợi Chỉ Bị Đứt",
		"url": [""],
		"img": "euV4KRpvlik",
		"dur": "19:06",
		"cId": "A3.5",
		"eTit": "Chapter 5 — Three broken threads"
	  },
	  {
		"stt": 6,
		"tit": "Lâu Đài Baskerville",
		"url": [""],
		"img": "GMkyw8GC6oM",
		"dur": "17:41",
		"cId": "A3.6",
		"eTit": "Chapter 6 — Baskerville hall"
	  },
	  {
		"stt": 7,
		"tit": "Nhà Tự Nhiên Học",
		"url": [""],
		"img": "6-h5a36rUW0",
		"dur": "23:28",
		"cId": "A3.7",
		"eTit": "Chapter 7 — The Stapletons of Merripit house"
	  },
	  {
		"stt": 8,
		"tit": "Bản Phúc Trình Đầu Tiên Của Bác Sĩ Watson",
		"url": [""],
		"img": "5DpPSL3N4l0",
		"dur": "13:25",
		"cId": "A3.8",
		"eTit": "Chapter 8 — First report of Dr. Watson"
	  },
	  {
		"stt": 9,
		"tit": "Bản Phúc Trình Thứ Hai Của Bác Sĩ Watson",
		"url": [""],
		"img": "rFTfgCmlE50",
		"dur": "26:25",
		"cId": "A3.9",
		"eTit": "Chapter 9 — The light upon the moor"
	  },
	  {
		"stt": 10,
		"tit": "Những Đoạn Trích Từ Nhật Ký Của Bác Sĩ Watson",
		"url": [""],
		"img": "ow38wnffwlM",
		"dur": "17:12",
		"cId": "A3.10",
		"eTit": "Chapter 10 — Extract from the diary of Dr. Watson"
	  },
	  {
		"stt": 11,
		"tit": "Người Đứng Trên Cột Đá Hoa Cương",
		"url": [""],
		"img": "PUkOZ9kYwe0",
		"dur": "20:42",
		"cId": "A3.11",
		"eTit": "Chapter 11 — The man on the tor"
	  },
	  {
		"stt": 12,
		"tit": "Cái Chết Trên Khu Đầm Lầy",
		"url": [""],
		"img": "EdhPeZHSOOA",
		"dur": "23:46",
		"cId": "A3.12",
		"eTit": "Chapter 12 — Death on the moor"
	  },
	  {
		"stt": 13,
		"tit": "Giăng Lưới",
		"url": [""],
		"img": "N1beWxEesBY",
		"dur": "16:51",
		"cId": "A3.13",
		"eTit": "Chapter 13 — Fixing the nets"
	  },
	  {
		"stt": 14,
		"tit": "Con Chó Của Dòng Họ Baskerville",
		"url": [""],
		"img": "AIrj2ROmqHw",
		"dur": "18:35",
		"cId": "A3.14",
		"eTit": "Chapter 14 — The Hound of the Baskervilles"
	  },
	  {
		"stt": 15,
		"tit": "Hồi Tưởng",
		"url": [""],
		"img": "FawO6_emGKs",
		"dur": "16:30",
		"cId": "A3.15",
		"eTit": "Chapter 15 — A retrospection"
	  }
	]
  },
  {
    "title": "Thung Lũng Khủng Khiếp",
    "eTitle": "The Valley of Fear",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Hùng Sơn",
    "cover": "https://i0.wp.com/sachnoiviet.net/wp-content/uploads/2022/05/thung-lung-khung-khiep.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/thung-lung-khung-khiep#/fwdrapPlayer0?catid=0&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-thung-lung-khung-khiep-hung-son",
      "https://sachnoiviet.net/sach-noi/thung-lung-khung-khiep",
      "https://archive.org/details/thung-lung-khung-khiep-tttrinhtham",
      "https://www.youtube.com/playlist?list=PLBLp8ljAjGVqEIk0tRL53kjvvr5mpxipf"
    ],
    "grp": ["SH.A4$1", "SH.VTC-TT", "SH.A4"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 1,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-thung-lung-khung-khiep-hung-son/<*~~*>-Thung-Lung-Khung-Khiep-(KenhSachNoi.Com).mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/thung-lung-khung-khiep-tttrinhtham/<*~~*>. Tlkk - Tin báo.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "year": "1914-1915",
    "tap": [
      {"label": "Phần 1. Tấn bi kịch ở lâu đài Birlstone (Part I — The tragedy of Birlstone)", "f": 1, "t":  7},
      {"label": "Phần 2. Những người tiên phong (Part II — The scowrers)"         , "f": 8, "t": 15}
    ],
    "intro": "<b>Thung Lũng Khủng Khiếp</b> (Tiếng Anh: The Valley of Fear) là tiểu thuyết về Sherlock Holmes thứ tư và cũng là cuối cùng của Sir Arthur Conan Doyle. Câu chuyện được xuất bản lần đầu trên Tạp chí Strand Magazine từ tháng 9 năm 1914 đến tháng 5 năm 1915. Cuốn sách đầu tiên được đăng ký bản quyền vào năm 1914, và được xuất bản lần đầu tiên bởi Công ty George H. Doran ở New York vào ngày 27 tháng 2 năm 1915, và được minh họa bởi Arthur I. Keller.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Tin báo",
		"url": ["", ""],
		"img": "mnMOXqU2IAM",
		"dur": "15:32",
		"cId": "A4.1",
		"eTit": "Chapter I — The warning"
	  },
	  {
		"stt": 2,
		"tit": "Sherlock Holmes diễn thuyết",
		"url": ["", ""],
		"img": "azk7s-4WSSs",
		"dur": "13:52",
		"cId": "A4.2",
		"eTit": "Chapter II — Sherlock Holmes discourses"
	  },
	  {
		"stt": 3,
		"tit": "Tấn bi kịch ở Birlstone",
		"url": ["", ""],
		"img": "VbmeukUh2QI",
		"dur": "16:36",
		"cId": "A4.3",
		"eTit": "Chapter III — The tragedy of Birlstone"
	  },
	  {
		"stt": 4,
		"tit": "Tối mò",
		"url": ["", ""],
		"img": "dCnPasy9sKk",
		"dur": "19:24",
		"cId": "A4.4",
		"eTit": "Chapter IV — Darkness"
	  },
	  {
		"stt": 5,
		"tit": "Những nhân vật của tấn thảm kịch",
		"url": ["", ""],
		"img": "wlcbw2ByMpk",
		"dur": "21:08",
		"cId": "A4.5",
		"eTit": "Chapter V — The people of the drama"
	  },
	  {
		"stt": 6,
		"tit": "Tia sáng trong đêm đen",
		"url": ["", ""],
		"img": "9e4FULI1JS0",
		"dur": "19:32",
		"cId": "A4.6",
		"eTit": "Chapter VI — A dawning light"
	  },
	  {
		"stt": 7,
		"tit": "Giải đáp",
		"url": ["", ""],
		"img": "Lzu3NQlDnz0",
		"dur": "21:25",
		"cId": "A4.7",
		"eTit": "Chapter VII — The solution"
	  },
	  {
		"stt": 8,
		"tit": "Con người ấy",
		"url": ["", ""],
		"img": "IFbSukLx8xE",
		"dur": "13:09",
		"cId": "A4.8",
		"eTit": "Chapter I — The man"
	  },
	  {
		"stt": 9,
		"tit": "Người trưởng toán",
		"url": ["", ""],
		"img": "tsL43wPObaA",
		"dur": "26:04",
		"cId": "A4.9",
		"eTit": "Chapter II — The Bodymaster"
	  },
	  {
		"stt": 10,
		"tit": "Chi nhánh 341 ở Vermissa",
		"url": ["", ""],
		"img": "onKHFHvBcDw",
		"dur": "27:25",
		"cId": "A4.10",
		"eTit": "Chapter III — Lodge 341, Vermissa"
	  },
	  {
		"stt": 11,
		"tit": "Thung lũng khủng khiếp",
		"url": ["", ""],
		"img": "RSUzRYI0Qd8",
		"dur": "16:34",
		"cId": "A4.11",
		"eTit": "Chapter IV — The Valley of Fear"
	  },
	  {
		"stt": 12,
		"tit": "Giờ đen tối",
		"url": ["", ""],
		"img": "IEQTwL5kgZk",
		"dur": "17:12",
		"cId": "A4.12",
		"eTit": "Chapter V — The darkest hour"
	  },
	  {
		"stt": 13,
		"tit": "Nguy hiểm",
		"url": ["", ""],
		"img": "Z6Es6IAbzk0",
		"dur": "15:39",
		"cId": "A4.13",
		"eTit": "Chapter VI — Danger"
	  },
	  {
		"stt": 14,
		"tit": "Birdy sập bẫy",
		"url": ["", ""],
		"img": "SOhDOyvNi2k",
		"dur": "14:45",
		"cId": "A4.14",
		"eTit": "Chapter VII — The trapping of Birdy Edwards"
	  },
	  {
		"stt": 15,
		"tit": "Tác phẩm bậc thầy (Hết)",
		"url": [
		  "",
		  "https://archive.org/download/thung-lung-khung-khiep-tttrinhtham/15. Tlkk - Tác phẩm bậc thầy (Hết).mp3"
		],
		"img": "M3IZxGRSm78",
		"dur": "04:11",
		"cId": "A4.15",
		"eTit": "Epilogue"
	  }
	]
  },
  {
    "title": "Những cuộc phiêu lưu của Sherlock Holmes",
    "eTitle": "The Adventures of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Hùng Sơn",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Nhung-cuoc-phieu-luu-cua-Sherlock-Holmes-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/nhung-cuoc-phieu-luu-cua-sherlock-holmes#/fwdrapPlayer0?catid=6&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-nhung-cuoc-phieu-luu-cua-sherlockholmes",
      "https://phatphapungdung.com/sach-noi/tham-tu-sherlock-holmes-61483.html"
    ],
    "grp": ["SH.B$2", "SH.VTC-TN", "SH.B"],
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-nhung-cuoc-phieu-luu-cua-sherlockholmes/<*~~*>_(KenhSachNoi.Com).mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "year": "1891-1892",
    "intro": "<b>Những cuộc phiêu lưu của Sherlock Holmes và bác sĩ Watson</b> (Tiếng Anh: The adventures of Sherlock Holmes and Dr. Watson) là nhan đề hậu thế đặt cho loạt truyện xoay quanh hành trạng nhân vật thám tử Sherlock Holmes cùng cộng sự-bác sĩ Watson, do tác giả Arthur Conan Doyle sáng tác và ấn hành giai đoạn 1887 - 1927 tại London.<br/>Tác phẩm được coi là tiêu biểu nhất của dòng văn chương trinh thám và cũng thuộc số ít văn phẩm đặc trưng cho thời kì Victoria-Edward.",
    "parts": [
      {
        "stt": 1,
        "tit": "Vụ tai tiếng xứ Bohemia",
        "url": "01.Vụ scandal ở xứ Bohemia",
        "dur": "36:43",
        "cId": "B.1",
        "img": "uGi4z9MmIHc",
        "year": "1891",
        "eTit": "A Scandal in Bohemia"
      },
      {
        "stt": 2,
        "tit": "Hội tóc hung",
        "url": "02.Hội tóc đỏ",
        "dur": "35:38",
        "cId": "B.2",
        "img": "Znreuopxy4A",
        "year": "1891",
        "eTit": "The Red Headed League"
      },
      {
        "stt": 3,
        "tit": "Vụ mất tích kì lạ",
        "url": [
          "03.Một vụ mất tích kỳ lạ",
          "1-Mot-Vu-Mat-Tich-Ky-La"
        ],
        "dur": "28:58",
        "cId": "B.3",
        "img": "e9XB1DVhJxM",
        "year": "1891",
        "eTit": "A Case of Identity"
      },
      {
        "stt": 4,
        "tit": "Bí mật tại thung lũng Boscombe",
        "url": [
          "04.Vụ án tại thung lũng Boscombe",
          "3-Vu-An-Tai-Thung-Lung-Boscom"
        ],
        "dur": "40:21",
        "cId": "B.4",
        "img": "aWNavk0my64",
        "year": "1891",
        "eTit": "The Boscombe Valley Mystery"
      },
      {
        "stt": 5,
        "tit": "Năm hạt cam",
        "url": "05.Năm hạt cam khô",
        "dur": "29:43",
        "cId": "B.5",
        "img": "04xO_uZKdJw",
        "year": "1891",
        "eTit": "The Five Orange Pips"
      },
      {
        "stt": 6,
        "tit": "Người đàn ông môi trề",
        "url": "06.Người đàn ông môi trề",
        "dur": "36:33",
        "cId": "B.6",
        "img": "xZYviLWLJDo",
        "year": "1891",
        "eTit": "The Man with the Twisted Lip"
      },
      {
        "stt": 7,
        "tit": "Viên ngọc bích màu xanh da trời",
        "url": "07.Cuộc phiêu lưu của viên kim cương",
        "dur": "32:12",
        "cId": "B.7",
        "img": "g5vUyuZoOkA",
        "year": "1892",
        "eTit": "The Adventure of the Blue Carbuncle"
      },
      {
        "stt": 8,
        "tit": "Dải băng lốm đốm",
        "url": "08.Dải băng lốm đốm",
        "dur": "40:45",
        "cId": "B.8",
        "img": "5d4GSe_2twY",
        "year": "1892",
        "eTit": "The Adventure of the Speckled Band"
      },
      {
        "stt": 9,
        "tit": "Ngón tay cái của viên kỹ sư",
        "url": "09.Ngón tay cái của người kỹ sư",
        "dur": "45:25",
        "cId": "B.9",
        "img": "ZJXl446Qa3k",
        "year": "1892",
        "eTit": "The Adventure of the Engineer’s Thumb"
      },
      {
        "stt": 10,
        "tit": "Chàng quý tộc độc thân",
        "url": [
          "10.Chàng quý tộc độc thân",
          "2-Chang-Quy-Toc-Doc-Than"
        ],
        "dur": "35:31",
        "cId": "B.10",
        "img": "TK9tkOBLsc4",
        "year": "1892",
        "eTit": "The Adventure of the Noble Bachelor"
      },
      {
        "stt": 11,
        "tit": "Chiếc vương miện gắn ngọc Berin",
        "url": [
          "11.Chiếc vương miện bằng ngọc Beryl",
          "5-Chiec-Vuong-Mien-Bang-Ngoc-Berlin"
        ],
        "dur": "45:43",
        "cId": "B.11",
        "img": "DqUMNB6LP0k",
        "year": "1892",
        "eTit": "The Adventure of the Beryl Coronet"
      },
      {
        "stt": 12,
        "tit": "Vùng đất những dây dẻ đỏ",
        "url": "12.Những cây dẻ đỏ",
        "dur": "39:45",
        "cId": "B.12",
        "img": "YfutmnmEfHA",
        "year": "1892",
        "eTit": "The Adventure of the Copper Beeches"
      }
    ]
  },
  {
    "title": "Hồi Ức Về Shelock Holmes",
    "eTitle": "Memoirs of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Hùng Sơn",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Nhung-hoi-uc-ve-Sherlock-Holmes-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/hoi-uc-ve-sherlock-holmes#fwdrapPlayer0?catid=5&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-hoi-uc-ve-sherlockholmes",
      "https://phatphapungdung.com/sach-noi/tham-tu-sherlock-holmes-61483.html"
    ],
    "grp": ["SH.C$2", "SH.VTC-TN", "SH.C"],
    "year": "1892-1893",
    "wc": {
	  "url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-hoi-uc-ve-sherlockholmes/<*~~*>_(KenhSachNoi.Com).mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/sherlock-<*~~*>"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "intro": "<b>Hồi Ức Về Shelock Holmes</b> (Tiếng Anh: The Memoirs of Sherlock Holmes). Sherlock Holmes là một nhân vật thám tử hư cấu vào cuối thế kỉ 19 và đầu thế kỉ 20, xuất hiện lần đầu trong tác phẩm của nhà văn Arthur Conan Doyle xuất bản năm 1887.<br/>Ông là thám tử tư ở Luân Đôn nổi tiếng nhờ trí thông minh, khả năng suy diễn logic và quan sát tinh tường trong khi phá những vụ án mà cảnh sát phải bó tay. Nhiều người cho rằng Sherlock Holmes là nhân vật thám tử hư cấu nổi tiếng nhất trong lịch sử văn học và là một trong những nhân vật văn học được biết đến nhiều nhất trên toàn thế giới.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Ngọn lửa bạc",
		"url": "01.Ngọn lửa bạc",
		"dur": "45:22",
		"cId": "C.1",
		"img": "x87XsKtEBHw",
		"year": "1892",
		"eTit": "Silver Blaze"
	  },
	  {
		"stt": 2,
		"tit": "Gương mặt vàng vọt",
		"url": "02.Bộ mặt vàng vọt",
		"dur": "28:08",
		"cId": "C.2",
		"img": "6psRjfu14Ig",
		"year": "1893",
		"eTit": "The Yellow Face"
	  },
	  {
		"stt": 3,
		"tit": "Người làm thuê cho nhà môi giới chứng khoán",
		"url": "03.Người làm thuê cho nhà môi giới chứng khoán",
		"dur": "27:59",
		"cId": "C.3",
		"img": "fIKqrBqx1zU",
		"year": "1893",
		"eTit": "The Stock Broker’s Clerk"
	  },
	  {
		"stt": 4,
		"tit": "Con tàu Gloria Scott",
		"url": "04.Con tàu Gloria Scot",
		"dur": "36:41",
		"cId": "C.4",
		"img": "JF2GdXHWD7Q",
		"year": "1893",
		"eTit": "The Gloria Scott"
	  },
	  {
		"stt": 5,
		"tit": "Tục lệ nhà Musgrave",
		"url": ["05.Tục lệ ở dòng họ Musgrave", "3-05/Sherlock-3-01.mp3"],
		"dur": "33:39",
		"cId": "C.5",
		"img": "XCe6oRN_BwY",
		"year": "1893",
		"eTit": "The Musgrave Ritual"
	  },
	  {
		"stt": 6,
		"tit": "Vụ án ở Reigate",
		"url": ["06.Vụ án ở Reigate", "2-04/Sherlock-2-01.mp3"],
		"dur": "34:10",
		"cId": "C.6",
		"img": "-uN2OvcHfgU",
		"year": "1893",
		"eTit": "The Reigate Puzzle"
	  },
	  {
		"stt": 7,
		"tit": "Kẻ dị dạng",
		"url": ["07.Kẻ dị dạng", "1-05/Sherlock-1-04.mp3"],
		"dur": "30:48",
		"cId": "C.7",
		"img": "YWA8cdzHfPc",
		"year": "1893",
		"eTit": "The Crooked Man"
	  },
	  {
		"stt": 8,
		"tit": "Bệnh nhân thường trú",
		"url": [
		  "08.Bệnh nhân thường trú",
		  "1-05/Sherlock-1-06.mp3",
		  "https://archive.org/download/sherlock-2-04/Sherlock-2-02.mp3",
		  "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-6-Nguoi-Khach-Tro-Duoc-Huong-Bong-Loc-www.phatphapungdung.com.mp3"
		],
		"dur": "30:29",
		"cId": "C.8",
		"img": "fF6rSGt_zjs",
		"year": "1893",
		"eTit": "The Resident Patient"
	  },
	  {
		"stt": 9,
		"tit": "Người thông ngôn Hy Lạp",
		"url": ["09.Người phiên dịch Hy Lạp ", "2-04/Sherlock-2-03.mp3"],
		"dur": "29:48",
		"cId": "C.9",
		"img": "tVFnN7_g-GE",
		"year": "1893",
		"eTit": "The Greek Interpreter"
	  },
	  {
		"stt": 10,
		"tit": "Bản hiệp ước hải quân",
		"url": ["10.Bản hiệp ước hải quân", "2-04/Sherlock-2-04.mp3"],
		"dur": "58:09",
		"cId": "C.10",
		"img": "hStxU_q485c",
		"year": "1893",
		"eTit": "The Naval Treaty"
	  },
	  {
		"stt": 11,
		"tit": "Công việc cuối cùng của Sherlock Holmes",
		"url": [
		  "11.Công việc sau cùng của Holmes",
		  "1-05/Sherlock-1-07.mp3",
		  "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-7-Cong-Viec-Sau-Cung-Cua-Holmes-www.phatphapungdung.com.mp3"
		],
		"dur": "35:34",
		"cId": "C.11",
		"img": "A8NK-aJ7YsM",
		"year": "1893",
		"eTit": "The Final Problem"
	  }
	]},
  {
    "title": "Sherlock Holmes Trở Về",
    "eTitle": "The Return of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Hùng Sơn",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Sherlock-Holmes-tro-ve-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/sherlock-holmes-tro-ve#/fwdrapPlayer0?catid=4&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-sherlock-holmes-tro-ve"
    ],
    "grp": ["SH.D$2", "SH.VTC-TN", "SH.D"],
    "year": "1903-1904",
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-sherlock-holmes-tro-ve/<*~~*>_(KenhSachNoi.Com).mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/sherlock-<*~~*>"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "intro": "Sherlock Holmes trở về - The Return of Sherlock Holmes, bao gồm 13 truyện ngắn được đăng trên tờ The Strand từ năm 1903 đến 1904.<br/><b>Sherlock Holmes</b> đã xuất hiện trong 4 tiểu thuyết và 56 truyện ngắn của nhà văn Conan Doyle. Hầu như tất cả các tác phẩm đều được viết dưới dạng ghi chép của bác sĩ John H. Watson, người bạn thân thiết và người ghi chép tiểu sử của Holmes, chỉ có 2 tác phẩm được viết dưới dạng ghi chép của chính Holmes và 2 tác phẩm khác dưới dạng ghi chép của người thứ ba. Hai tác phẩm đầu tiên trong số này, 2 tiểu thuyết ngắn, xuất hiện lần đầu tiên trên tờ Beetons Christmas Annual năm 1887 và tờ Lippincotts Monthly Magazine năm 1890. Thám tử Holmes trở nên cực kì nổi tiếng khi loạt truyện ngắn của Doyle được xuất bản trên tạp chí The Strand Magazine năm 1891. Các tác phẩm được viết xoay quanh thời gian từ năm 1878 đến năm 1903 với vụ án cuối cùng vào năm 1914.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Ngôi nhà trống không",
		"url": [
		  "01.Căn nhà trống không",
		  "1-05/Sherlock-1-08.mp3",
		  "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-8-Ngoi-Nha-Trong-Khong-www.phatphapungdung.com.mp3"
		],
		"dur": "38:18",
		"cId": "D.1",
		"img": "jM7ouKLd2dc",
		"year": "1903",
		"eTit": "The Adventure of the Empty House"
	  },
	  {
		"stt": 2,
		"tit": "Nhà thầu khoáng ở Norwood",
		"url": [
		  "02.Nhà thầu khoán ở Norwood",
		  "1-05/Sherlock-1-09.mp3",
		  "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-9-Nha-Thau-Khoang-O-North-Hut-www.phatphapungdung.com.mp3"
		],
		"dur": "41:06",
		"cId": "D.2",
		"img": "gc8bSTxVt6A",
		"year": "1903",
		"eTit": "The Adventure of the Norwood Builder"
	  },
	  {
		"stt": 3,
		"tit": "Những hình nhân nhảy múa",
		"url": ["03.Những hình nhân nhảy múa", "2-04/Sherlock-2-08.mp3"],
		"dur": "43:37",
		"cId": "D.3",
		"img": "W2h-imoI_l0",
		"year": "1903",
		"eTit": "The Adventure of the Dancing Men"
	  },
	  {
		"stt": 4,
		"tit": "Cô gái đi xe đạp",
		"url": ["04.Cô gá iđi xe đạp", "2-04/Sherlock-2-05.mp3"],
		"dur": "34:52",
		"cId": "D.4",
		"img": "6t-1BsyQ-vg",
		"year": "1903",
		"eTit": "The Adventure of the Solitary Cyclist"
	  },
	  {
		"stt": 5,
		"tit": "Câu chuyện tại ký túc xá",
		"url": ["05.Chuyện ở ký túc xá", "2-04/Sherlock-2-06.mp3"],
		"dur": "56:47",
		"cId": "D.5",
		"img": "VYvBcxF2m7g",
		"year": "1904",
		"eTit": "The Adventure of the Priory School"
	  },
	  {
		"stt": 6,
		"tit": "Peter hung bạo",
		"url": ["06.Peter hung bạo", "2-04/Sherlock-2-07.mp3"],
		"dur": "38:06",
		"cId": "D.6",
		"img": "NtWXctz0JL8",
		"year": "1904",
		"eTit": "The Adventure of Black Peter"
	  },
	  {
		"stt": 7,
		"tit": "Tên tống tiền ngoại hạng",
		"url": ["07.Tên tống tiền ngoại hạng", "2-04/Sherlock-2-09.mp3"],
		"dur": "30:32",
		"cId": "D.7",
		"img": "EpM_97Ckzdg",
		"year": "1904",
		"eTit": "The Adventure of Charles Augustus Milverton"
	  },
	  {
		"stt": 8,
		"tit": "Sáu bức tượng Napoleon",
		"url": ["08.Sáu bức tượng Napoléon", "2-04/Sherlock-2-10.mp3"],
		"dur": "31:01",
		"cId": "D.8",
		"img": "31FXGEh9yTk",
		"year": "1904",
		"eTit": "The Adventure of the Six Napoleons"
	  },
	  {
		"stt": 9,
		"tit": "Ba sinh viên",
		"url": ["09.Ba sinh viên", "2-04/Sherlock-2-11.mp3"],
		"dur": "29:16",
		"cId": "D.9",
		"img": "lw-W5zoXdMo",
		"year": "1904",
		"eTit": "The Adventure of the Three Students"
	  },
	  {
		"stt": 10,
		"tit": "Cái kính kẹp mũi bằng vàng",
		"url": ["10.Chiếc kính có kẹp mũi bằng vàng", "2-04/Sherlock-2-14.mp3"],
		"dur": "42:29",
		"cId": "D.10",
		"img": "a9aAMg_gKaI",
		"year": "1904",
		"eTit": "The Adventure of the Golden Pince-Nez"
	  },
	  {
		"stt": 11,
		"tit": "Một trung vệ bị mất tích",
		"url": ["11.Một trung vệ bị mất tích", "2-04/Sherlock-2-13.mp3"],
		"dur": "28:01",
		"cId": "D.11",
		"img": "uSNWA6aAXjM",
		"year": "1904",
		"eTit": "The Adventure of the Missing Three-Quarter"
	  },
	  {
		"stt": 12,
		"tit": "Vụ án tại Abbey Grange",
		"url": [
		  "12.Vụ án tại Abbey Grange_Bacáichénrượu",
		  "2-04/Sherlock-2-12.mp3"
		],
		"dur": "40:06",
		"cId": "D.12",
		"img": "PRAfXysyhUI",
		"year": "1904",
		"eTit": "The Adventure of the Abbey Grange"
	  },
	  {
		"stt": 13,
		"tit": "Vết máu thứ hai",
		"url": ["13.Vết máu thứ hai", "2-04/Sherlock-2-15.mp3"],
		"dur": "41:03",
		"cId": "D.13",
		"img": "MzRB9_Rba_g",
		"year": "1904",
		"eTit": "The Adventure of the Second Stain"
	  }
	]},
  {
    "title": "Cung đàn sau cuối",
    "eTitle": "His Last Bow",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Hùng Sơn",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2022/01/Truyen-trinh-tham-Cung-Dan-Sau-Cuoi-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/cung-dan-sau-cuoi#/fwdrapPlayer0?catid=3&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-cung-dan-sau-cuoi"
    ],
    "grp": ["SH.E$2", "SH.VTC-TN", "SH.E"],
    "year": "1908-1917",
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-cung-dan-sau-cuoi/<*~~*> (KenhSachNoi.Com).mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/sherlock-<*~~*>"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "intro": "<b>Cung đàn sau cuối</b> (Tiếng Anh: His Last Bow). Bà Hudson, chủ nhà trọ của Sherlock Holmes là người cực kỳ kiên nhẫn. Chẳng những căn hộ của Holmes lúc nào cung đày ấp những người quái dị, mà Holmes lại lôi thôi lếch thếch cực cùng, sự ghiền nhạc vào giờ ngủ của mọi người, thói quen tập bắn súng lục trong phòng, các cuộc thử nghiệm hóa họa vừa kỳ lạ, vừa hôi thối, các thô bạo và nguy hiểm bao quanh biến anh thành người thuê nhà bê bối nhất tại London.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Đêm kinh hoàng ở điền trang Wisteria",
		"url": ["08.Đêm kinh hoàng_MC Hùng Sơn", "3-05/Sherlock-3-02.mp3"],
		"dur": "49:19",
		"cId": "E.1",
		"img": "lj20aFxR3Jo",
		"year": "1908",
		"eTit": "The Adventure of Wisteria Lodge"
	  },
	  {
		"stt": 2,
		"tit": "Vòng tròn đỏ",
		"url": ["07.Vòng tròn đỏ_MC Hùng Sơn", "3-05/Sherlock-3-04.mp3"],
		"dur": "35:27",
		"cId": "E.2",
		"img": "6KGRF7jQrUA",
		"year": "1911",
		"eTit": "The Adventure of the Red Circle"
	  },
	  {
		"stt": 3,
		"tit": "Hai lỗ tai trong hộp các tông",
		"url": [
		  "04.Hai lỗ tai người trong hộp các tông_MC Hùng Sơn",
		  "3-05/Sherlock-3-03.mp3"
		],
		"dur": "30:55",
		"cId": "E.3",
		"img": "cDXFpAteWvU",
		"year": "1893",
		"eTit": "The Adventure of the Cardboard Box"
	  },
	  {
		"stt": 4,
		"tit": "Các bản vẽ tàu ngầm Bruce Partington",
		"url": [
		  "03.Các bản vẽ của tàu ngầm Bruce Partington_MC Hùng Sơn",
		  "3-05/Sherlock-3-05.mp3"
		],
		"dur": "53:06",
		"cId": "E.4",
		"year": "1908",
		"eTit": "The Adventure of the Bruce-Partington Plans"
	  },
	  {
		"stt": 5,
		"tit": "Sherlock Holmes hấp hối",
		"url": [
		  "06.Sherlock Holmes hấp hối_MC Hùng Sơn",
		  "1-05/Sherlock-1-10.mp3",
		  "https://s1.phatphapungdung.com/media/bookspeak/TruyenDoc/ThamTuSherlockHolmes/Sach-Noi-Audio-Book-Tham-Tu-Sherlock-Holmes-10-Sherlock-Holmes-Hap-Hoi-www.phatphapungdung.com.mp3"
		],
		"dur": "30:26",
		"cId": "E.5",
		"img": "qaC905N4LGI",
		"year": "1913",
		"eTit": "The Adventure of the Dying Detective"
	  },
	  {
		"stt": 6,
		"tit": "Quý bà mất tích",
		"url": [
		  "05.Quý bà Frances Carfax mất tích_MC Hùng Sơn",
		  "3-05/Sherlock-3-06.mp3"
		],
		"dur": "36:10",
		"cId": "E.6",
		"year": "1911",
		"eTit": "The Disappearance of Lady Frances Carfax"
	  },
	  {
		"stt": 7,
		"tit": "Bàn chân của quỷ",
		"url": ["01.Bàn chân quỷ_MC Hùng Sơn", "3-05/Sherlock-3-07.mp3"],
		"dur": "40:38",
		"cId": "E.7",
		"img": "gmiORfDF79g",
		"year": "1910",
		"eTit": "The Adventure of the Devil’s Foot"
	  },
	  {
		"stt": 8,
		"tit": "Cung đàn sau cuối",
		"url": ["02.Cung đàn sau cuối_MC Hùng Sơn", "3-05/Sherlock-3-08.mp3"],
		"dur": "29:47",
		"cId": "E.8",
		"img": "2TyuRmJF_sU",
		"year": "1917",
		"eTit": "His Last Bow"
	  }
	]},
  {
    "title": "Tàng thư Sherlock Holmes",
    "eTitle": "The Case Book of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Hùng Sơn",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2022/02/Truyen-trinh-tham-Tang-thu-Sherlock-Holmes-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/tang-thu-sherlock-holmes#/fwdrapPlayer0?catid=1&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-tang-thu-sherlock-holmes"
    ],
    "grp": ["SH.F$2", "SH.VTC-TN", "SH.F"],
    "year": "1921-1927",
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-tang-thu-sherlock-holmes/<*~~*>_MC Hùng Sơn (KenhSachNoi.Com).mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/sherlock-<*~~*>"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLBLp8ljAjGVpehp-5JxIME-C1Yq2cVK27"
    },
    "intro": "<b>Tàng thư của Sherlock Holmes</b> (Tiếng Anh: The Case Book of Sherlock Holmes) là lời nói đầu mà Conan Doyle mượn lời bác sĩ Watson cũng là một lời chia tay thực sự của Holmes với độc giả khắp nơi. <b>Sherlock Holmes</b> là một tác phẩm trinh thám vĩ đại, có thể nói nó là tác phẩm hay nhất của thể loại đòi hỏi óc sáng tạo và tầm hiểu biết  rộng lớn này. Conan Doyle là nhà văn vĩ đại, ông cũng như đứa con tinh thần Sherlock Holmes của mình sẽ còn sống mãi trong lòng triệu triệu độc giả thế giới.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Người khách hàng nổi tiếng",
		"url": ["01.Nguoi Khach Hang Noi Tieng 1924", "3-05/Sherlock-3-09.mp3"],
		"dur": "43:09",
		"cId": "F.1",
		"img": "SBVZM3kZiLs",
		"year": "1924",
		"eTit": "The Adventure of the Illustrious Client"
	  },
	  {
		"stt": 2,
		"tit": "Người lính bị vảy nến",
		"url": ["02.Nguoi Linh Bi Vay Nen 1926", "3-05/Sherlock-3-10.mp3"],
		"dur": "32:58",
		"cId": "F.2",
		"img": "rDlIjQSPKR8",
		"year": "1926",
		"eTit": "The Adventure of the Blanched Soldier"
	  },
	  {
		"stt": 3,
		"tit": "Viên đá của Mazarin",
		"url": ["03.Vien Da cua Mazarin 1921", "3-05/Sherlock-3-11.mp3"],
		"dur": "29:09",
		"cId": "F.3",
		"img": "9M6lvfc0RNE",
		"year": "1921",
		"eTit": "The Adventure of the Mazarin Stone"
	  },
	  {
		"stt": 4,
		"tit": "Ba đầu hồi",
		"url": ["04.Ba Dau Hoi 1926", "3-05/Sherlock-3-15.mp3"],
		"dur": "30:45",
		"cId": "F.4",
		"img": "f0G1WX7e0Rw",
		"year": "1926",
		"eTit": "The Adventure of the Three Gables"
	  },
	  {
		"stt": 5,
		"tit": "Ma cà rồng vùng Sussex",
		"url": ["05.Ma Ca Rong O Sussex 1924", "3-05/Sherlock-3-14.mp3"],
		"dur": "28:11",
		"cId": "F.5",
		"img": "V-94mua-IRc",
		"year": "1924",
		"eTit": "The Adventure of the Sussex Vampire"
	  },
	  {
		"stt": 6,
		"tit": "Ba nguời họ Garridebs",
		"url": ["06.Ba Nguoi Ho Garrideb 1924", "3-05/Sherlock-3-12.mp3"],
		"dur": "28:12",
		"cId": "F.6",
		"img": "CH8yo2pYZe8",
		"year": "1924",
		"eTit": "The Adventure of the Three Garridebs"
	  },
	  {
		"stt": 7,
		"tit": "Bài toán cầu Thor",
		"url": ["07.Bai Toan Cau Thor 1922", "3-05/Sherlock-3-13.mp3"],
		"dur": "42:17",
		"cId": "F.7",
		"img": "nodxiymG0_4",
		"year": "1922",
		"eTit": "The Problem of Thor Bridge"
	  },
	  {
		"stt": 8,
		"tit": "Người đi bốn chân",
		"url": ["08.Nguoi Di Bon Chan 1923", "3-05/Sherlock-3-16.mp3"],
		"dur": "34:43",
		"cId": "F.8",
		"year": "1923",
		"eTit": "The Adventure of the Creeping Man"
	  },
	  {
		"stt": 9,
		"tit": "Cái bờm sư tử",
		"url": ["09.Cái bờm sư tử  1926", "3-05/Sherlock-3-18.mp3"],
		"dur": "33:01",
		"cId": "F.9",
		"img": "Dnd53x8j4h4",
		"year": "1926",
		"eTit": "The Adventure of the Lions Mane"
	  },
	  {
		"stt": 10,
		"tit": "Bà thuê nhà mang mạng che",
		"url": "10.Bà thuê nhà mang mạng che 1927",
		"dur": "20:42",
		"cId": "F.10",
		"img": "NblzMxrNu0U",
		"year": "1927",
		"eTit": "The Adventure of the Veiled Lodger"
	  },
	  {
		"stt": 11,
		"tit": "Bí ẩn lâu đài Shoscombe",
		"url": ["11.Bi An Lau Dai Co Shoscombe 1927", "3-05/Sherlock-3-17.mp3"],
		"dur": "27:45",
		"cId": "F.11",
		"img": "JarycWjtz8A",
		"year": "1927",
		"eTit": "The Adventure of Shoscombe Old Place"
	  },
	  {
		"stt": 12,
		"tit": "Người bán sơn về hưu",
		"url": ["12.Người bán sơn về hưu 1926", "3-05/Sherlock-3-19.mp3"],
		"dur": "22:55",
		"cId": "F.12",
		"img": "j1traKVZes0",
		"year": "1926",
		"eTit": "The Adventure of the Retired Colourman"
	  }
	]},
  
  {
	  "title": "Cuộc điều tra màu đỏ",
	  "eTitle": "A Study in Scarlet",
	  "author": "Arthur Conan Doyle",
	  "type": "Tiểu thuyết",
	  "mc": "Tpd124",
	  "cover": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/ArthurConanDoyle_AStudyInScarlet_annual.jpg/440px-ArthurConanDoyle_AStudyInScarlet_annual.jpg",
	  "ssrc": [
		"https://kenhsachnoi.com/nghe/chiec-nhan-tinh-co#/fwdrapPlayer0?catid=10&trackid=6",
		"https://archive.org/details/chiec-nhan-tinh-co-kenhsachnoi.com/Chi%E1%BA%BFc+nh%E1%BA%ABn+t%C3%ACnh+c%E1%BB%9D+1887_P01.mp3",
		"https://audioaz.com/en/archive/archive-ChiecNhanTinhCoP03SherlockHolmestruyenaudio.NET",
		"https://archive.org/details/ChiecNhanTinhCoP03SherlockHolmestruyenaudio.NET"
	  ],
	  "grp": ["SH.A1$1", "SH.TDP124-TT", "SH.A1"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/chiec-nhan-tinh-co-kenhsachnoi.com/Chiếc nhẫn tình cờ 1887_P<*~~*>.mp3"
		  },
		  {
			"urlLine": 1,
			"nd": 2,
			"wcSrc": "https://archive.org/download/ChiecNhanTinhCoP03SherlockHolmestruyenaudio.NET/Chiec nhan tinh co-P<*~~*>-Sherlock Holmes[truyenaudio.NET].mp3"
		  }
		]
	  },
	  "year": "1887",
	  "tap": [
		{"label": "Phần I. Hồi ức của bác sĩ Watson (The Reminiscences of John H. Watson)" , "f": 1, "t":  7},
		{"label": "Phần 2: Vùng đất của các vị thánh (The country of the Saints)", "f": 8, "t": 13}
	  ],
	  "intro": "Tác phẩm được viết năm 1887, là câu chuyện đầu tiên xuất hiện nhân vật Sherlock Holmes và John H. Watson. Tác phẩm này đánh dấu sự ra đời của nhân vật nổi tiếng nhất trong văn học trinh thám Sherlock Holmes. Tác phẩm được xuất bản năm 1887. Đây là một trong 4 tiểu thuyết viết về Sherlock Holmes của Conan Doyle. Tác phẩm có tên là <b>Cuộc điều tra màu đỏ</b> (Tiếng Anh: Study in Scarlet ) là vì một câu nói của Sherlock Holmes ở chương IV 'John Rance tìm thấy gì?' với bác sĩ Watson, ông ấy đã miêu tả cuộc điều tra mà mình đang thực hiện là 'Cuộc điều tra màu đỏ': 'Có 1 sợi chỉ màu đỏ của án mạng luồn lách trong sợi chỉ không màu của cuộc sống. Và nhiệm vụ của chúng ta là tháo gỡ nó, cô lập nó và bóc trần mọi mặt của nó'. Nhưng một số nhà xuất bản ở Việt Nam đã tự ý lược bỏ phần này và dịch lại với tên <b>Chiếc nhẫn tình cờ</b>.",
	  "parts": [
		{
		  "stt": 1,
		  "tit": "Làm quen với Sherlock Holmes",
		  "url": ["", ""],
		  "dur": "15:55",
		  "cId": "A1.1",
		  "eTit": "Chapter 1 - Part I. Mr. Sherlock Holmes."
		},
		{
		  "stt": 2,
		  "tit": "Suy đoán, một môn khoa học",
		  "url": ["", ""],
		  "dur": "19:28",
		  "cId": "A1.2",
		  "eTit": "Chapter 2 - Part I. The science of deduction."
		},
		{
		  "stt": 3,
		  "tit": "Bí ẩn ở Lauriston Garden",
		  "url": ["", ""],
		  "dur": "27:05",
		  "cId": "A1.3",
		  "eTit": "Chapter 3 - Part I. The Lauriston Gardens mystery"
		},
		{
		  "stt": 4,
		  "tit": "Lời khai của cảnh sát John Rance",
		  "url": ["", ""],
		  "dur": "15:21",
		  "cId": "A1.4",
		  "eTit": "Chapter 4 - Part I. What John Rance had to tell."
		},
		{
		  "stt": 5,
		  "tit": "Cuộc viếng thăm của người khách lạ",
		  "url": ["", ""],
		  "dur": "14:17",
		  "cId": "A1.5",
		  "eTit": "Chapter 5 - Part I. Our advertisement brings a visitor."
		},
		{
		  "stt": 6,
		  "tit": "Gregson tìm thấy gì",
		  "url": ["", ""],
		  "dur": "20:27",
		  "cId": "A1.6",
		  "eTit": "Chapter 6 - Part I. Tobias Gregson shows what he can do."
		},
		{
		  "stt": 7,
		  "tit": "Một tia sáng trong đêm tối",
		  "url": ["", ""],
		  "dur": "19:09",
		  "cId": "A1.7",
		  "eTit": "Chapter 7 - Part I. Light in the darkness."
		},
		{
		  "stt": 8,
		  "tit": "Bình nguyên chết",
		  "url": ["", ""],
		  "dur": "24:00",
		  "cId": "A1.8",
		  "eTit": "Chapter 1 - Part II. On the great Alkali plain."
		},
		{
		  "stt": 9,
		  "tit": "Bông hoa Utah",
		  "url": ["", ""],
		  "dur": "22:09",
		  "cId": "A1.9",
		  "eTit": "Chapter 2 - Part II. The flower of Utah."
		},
		{
		  "stt": 10,
		  "tit": "Chạy trốn",
		  "url": ["", ""],
		  "dur": "14:47",
		  "cId": "A1.10",
		  "eTit": "Chapter 3 - Part II. A flight for life."
		},
		{
		  "stt": 11,
		  "tit": "Báo oán",
		  "url": ["", ""],
		  "dur": "16:28",
		  "cId": "A1.11",
		  "eTit": "Chapter 4 - Part II. The avenging angels."
		},
		{
		  "stt": 12,
		  "tit": "Phần tiếp trong nhật ký của bác sĩ Watson",
		  "url": ["", ""],
		  "dur": "24:45",
		  "cId": "A1.12",
		  "eTit": "Chapter 5 - Part II. A continuation of the reminiscences of John Watson, M.D."
		},
		{
		  "stt": 13,
		  "tit": "Kết thúc",
		  "url": ["", ""],
		  "dur": "13:27",
		  "cId": "A1.13",
		  "eTit": "Chapter 6 - Part II. The conclusion."
		}
	  ]
	},
  {
    "title": "Truy tìm Dấu Bộ Tứ",
    "eTitle": "The Sign of Four",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Tpd124",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Dau-bo-Tu-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/theo-dau-bo-tu-mc-hung-son#/fwdrapPlayer0?catid=26&trackid=9",
      "https://archive.org/details/kenhsachnoi.com-dau-bo-tu/Theo+dấu+bộ+tứ+1890_P(01).mp3"
    ],
    "grp": ["SH.A2$1", "SH.TDP124-TT", "SH.A2"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-dau-bo-tu/Theo dấu bộ tứ 1890_P(<*~~*>).mp3"
        }
      ]
    },
    "year": "1890",
    "intro": "<b>Dấu Bộ Tứ</b> (Tiếng Anh: The Sign of Four) được giới thiệu là một trong những tiểu thuyết hay nhất từ tác giả Sir Arthur Conan Doyle. Tựa đề ban đầu của tác phẩm là <i>The Sign of the Four</i>, và đây là tác phẩm tuyệt vời thứ hai trong loạt truyện về thám tử Sherlock Holmes của Sir Arthur Conan Doyle.<br/>Tại một bữa tiệc tại khách sạn Langham vào mùa hè năm 1889, một quản lý biên tập của tạp chí American Lippincott đã có cơ hội gặp gỡ với các tác giả nổi tiếng như Oscar Wilde và Arthur Conan Doyle. Tại buổi tiệc đặc biệt này, hai tác phẩm đặc sắc đã được giới thiệu: 'Dorian Gray' của Oscar Wilde và tác phẩm mới về Sherlock Holmes của Conan Doyle, ban đầu có tựa đề <i>The Sign of the Four</i> (Dấu của Bốn Người).<br/>Tác phẩm này lấy cảm hứng từ sự thành công của tác phẩm trước đó, <i>Cuộc điều tra màu đỏ</i> (A Study in Scarlet), và kể về một câu chuyện phức tạp liên quan đến Mary Morstan, con gái của một chỉ huy quân đội Ấn Độ đã mất tích. Mary Morstan gặp Sherlock Holmes và tiết lộ rằng cô đã nhận được sáu viên ngọc trai hàng năm vào ngày 7 tháng 7 từ một nguồn gửi không rõ danh tính.<br/>Cô chỉ có một manh mối duy nhất: một bản đồ của một pháo đài và tên ba người theo đạo Sikhs cùng với Jonathan Small. Điều này đánh dấu sự bắt đầu của cuộc phiêu lưu thú vị và kịch tính trong tác phẩm này.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Phép diễn dịch là một khoa học",
		"url": [""],
		"dur": "24:19",
		"cId": "A2.1",
		"eTit": "Chapter I. The science of deduction"
	  },
	  {
		"stt": 2,
		"tit": "Trình bày nội vụ",
		"url": [""],
		"dur": "17:20",
		"cId": "A2.2",
		"eTit": "Chapter II. The statement of the case"
	  },
	  {
		"stt": 3,
		"tit": "Đi tìm một giải đáp",
		"url": [""],
		"dur": "14:50",
		"cId": "A2.3",
		"eTit": "Chapter III. In quest of a solution"
	  },
	  {
		"stt": 4,
		"tit": "Câu chuyện của người hói đầu",
		"url": [""],
		"dur": "31:15",
		"cId": "A2.4",
		"eTit": "Chapter IV. The story of the bald-headed man"
	  },
	  {
		"stt": 5,
		"tit": "Tấm thảm kịch ở biệt trang Pondicherry",
		"url": [""],
		"dur": "20:31",
		"cId": "A2.5",
		"eTit": "Chapter V. The tragedy of Pondicherry Lodge"
	  },
	  {
		"stt": 6,
		"tit": "Sherlock Holmes bắt đầu diễn giảng",
		"url": [""],
		"dur": "27:06",
		"cId": "A2.6",
		"eTit": "Chapter VI. Sherlock Holmes gives a demonstration"
	  },
	  {
		"stt": 7,
		"tit": "Câu chuyện chiếc thùng tô-nô",
		"url": [""],
		"dur": "34:20",
		"cId": "A2.7",
		"eTit": "Chapter VII. The episode of the barrel"
	  },
	  {
		"stt": 8,
		"tit": "Nghĩa binh ở phố Baker",
		"url": [""],
		"dur": "27:50",
		"cId": "A2.8",
		"eTit": "Chapter VIII. The Baker street irregulars"
	  },
	  {
		"stt": 9,
		"tit": "Sợi dây xích đứt",
		"url": [""],
		"dur": "30:40",
		"cId": "A2.9",
		"eTit": "Chapter IX. A break in the chain"
	  },
	  {
		"stt": 10,
		"tit": "Hết đời tên dân đảo",
		"url": [""],
		"dur": "26:02",
		"cId": "A2.10",
		"eTit": "Chapter X. The end of the islander"
	  },
	  {
		"stt": 11,
		"tit": "Kho báu Agra",
		"url": [""],
		"dur": "17:55",
		"cId": "A2.11",
		"eTit": "Chapter XI. The great Agra treasure"
	  },
	  {
		"stt": 12,
		"tit": "Cuộc đời kỳ lạ của Jonathan Small",
		"url": [""],
		"dur": "45:02",
		"cId": "A2.12",
		"eTit": "Chapter XII. The strange story of Jonathan Small"
	  }
	]
  },
  {
    "title": "Con chó săn của dòng họ Baskervilles",
    "eTitle": "The Hound of the Baskervilles",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Tpd124",
    "cover": "https://www.dtv-ebook.com/images/files_2/2024/042024/con-cho-cua-dong-ho-baskervilles-arthur-conan-doyle.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/con-cho-cua-dong-ho-baskerviller#/fwdrapPlayer0?catid=9&trackid=15",
      "https://archive.org/details/kenhsachnoi.com-con-cho-cua-dong-ho-baskerville/Con-ch%C3%B3-d%C3%B2ng-h%E1%BB%8D-Baskerville-1902_P(01)-(KenhSachNoi.Com).mp3",
      "https://www.lachoncoc.com/2015/05/blog-post_29.html#gsc.tab=0",
      "https://archive.org/details/P09SherlockHolmestruyenaudio.NET"
    ],
    "grp": ["SH.A3$1", "SH.TDP124-TT", "SH.A3"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-con-cho-cua-dong-ho-baskerville/Con-chó-dòng-họ-Baskerville-1902_P(<*~~*>)-(KenhSachNoi.Com).mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/P09SherlockHolmestruyenaudio.NET/P<*~~*>-Sherlock Holmes[truyenaudio.NET].mp3"
        }
      ]
    },
    "year": "1901-1902",
    "intro": "<b>Con chó săn của dòng họ Baskerville</b> (tiếng Anh: The hound of the Baskervilles) là bộ thứ ba trong bốn cuốn tiểu thuyết tội phạm được Sir Arthur Conan Doyle sáng tác có sự tham gia của thám tử Sherlock Holmes.<br/>Ban đầu phần này được đăng trên Tạp chí Strand từ tháng 8 năm 1901 đến tháng 4 năm 1902, phần lớn lấy bối cảnh ở Dartmoor ở Devon ở miền Tây nước Anh. Câu chuyện kể về một vụ âm mưu giết người lấy cảm hứng từ truyền thuyết về một con chó săn đáng sợ, có nguồn gốc siêu nhiên. Sherlock Holmes và bạn đồng hành Bác sĩ Watson thực hiện điều tra vụ án. Đây là lần xuất hiện đầu tiên của Holmes kể từ sau sự kiện mô tả rằng ông đã chết trong truyện 'Công việc cuối cùng của Sherlock Holmes' và thành công của tác phẩm Con chó săn của dòng họ Baskerville đã dẫn đến sự hồi sinh trở lại của nhân vật.<br/>Là một trong những câu chuyện nổi tiếng nhất từng được viết, vào năm 2003, cuốn sách được liệt kê ở vị trí 128 của 200 <i>tiểu thuyết được yêu thích nhất</i> trên cuộc thăm dò toàn nước Anh Big Read của BBC. Năm 1999, nó được liệt kê là tiểu thuyết Holmes hàng đầu, với một đánh giá hoàn hảo 100/100 điểm từ các học giả nghiên cứu Sherlock Holmes.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Ông Sherlock Homes",
		"url": ["", ""],
		"dur": "16:13",
		"cId": "A3.1",
		"eTit": "Chapter 1 — Mr. Sherlock Holmes"
	  },
	  {
		"stt": 2,
		"tit": "Nỗi Bất Hạnh Của Dòng Họ Baskerville",
		"url": ["", ""],
		"dur": "26:34",
		"cId": "A3.2",
		"eTit": "Chapter 2 — The curse of the Baskervilles"
	  },
	  {
		"stt": 3,
		"tit": "Điểm Mấu Chốt",
		"url": ["", ""],
		"dur": "19:43",
		"cId": "A3.3",
		"eTit": "Chapter 3 — The problem"
	  },
	  {
		"stt": 4,
		"tit": "Ngài Henry Baskerville",
		"url": ["", ""],
		"dur": "26:13",
		"cId": "A3.4",
		"eTit": "Chapter 4 — Sir. Henry Baskerville"
	  },
	  {
		"stt": 5,
		"tit": "Ba Sợi Chỉ Bị Đứt",
		"url": ["", ""],
		"dur": "25:45",
		"cId": "A3.5",
		"eTit": "Chapter 5 — Three broken threads"
	  },
	  {
		"stt": 6,
		"tit": "Lâu Đài Baskerville",
		"url": ["", ""],
		"dur": "23:10",
		"cId": "A3.6",
		"eTit": "Chapter 6 — Baskerville hall"
	  },
	  {
		"stt": 7,
		"tit": "Nhà Tự Nhiên Học",
		"url": ["", ""],
		"dur": "31:25",
		"cId": "A3.7",
		"eTit": "Chapter 7 — The Stapletons of Merripit house"
	  },
	  {
		"stt": 8,
		"tit": "Bản Phúc Trình Đầu Tiên Của Bác Sĩ Watson",
		"url": ["", ""],
		"dur": "17:40",
		"cId": "A3.8",
		"eTit": "Chapter 8 — First report of Dr. Watson"
	  },
	  {
		"stt": 9,
		"tit": "Bản Phúc Trình Thứ Hai Của Bác Sĩ Watson",
		"url": ["", ""],
		"dur": "35:47",
		"cId": "A3.9",
		"eTit": "Chapter 9 — The light upon the moor"
	  },
	  {
		"stt": 10,
		"tit": "Những Đoạn Trích Từ Nhật Ký Của Bác Sĩ Watson",
		"url": ["", ""],
		"dur": "23:13",
		"cId": "A3.10",
		"eTit": "Chapter 10 — Extract from the diary of Dr. Watson"
	  },
	  {
		"stt": 11,
		"tit": "Người Đứng Trên Cột Đá Hoa Cương",
		"url": ["", ""],
		"dur": "27:37",
		"cId": "A3.11",
		"eTit": "Chapter 11 — The man on the tor"
	  },
	  {
		"stt": 12,
		"tit": "Cái Chết Trên Khu Đầm Lầy",
		"url": ["", ""],
		"dur": "31:59",
		"cId": "A3.12",
		"eTit": "Chapter 12 — Death on the moor"
	  },
	  {
		"stt": 13,
		"tit": "Giăng Lưới",
		"url": ["", ""],
		"dur": "22:00",
		"cId": "A3.13",
		"eTit": "Chapter 13 — Fixing the nets"
	  },
	  {
		"stt": 14,
		"tit": "Con Chó Của Dòng Họ Baskerville",
		"url": ["", ""],
		"dur": "23:30",
		"cId": "A3.14",
		"eTit": "Chapter 14 — The Hound of the Baskervilles"
	  },
	  {
		"stt": 15,
		"tit": "Hồi Tưởng",
		"url": ["", ""],
		"dur": "21:30",
		"cId": "A3.15",
		"eTit": "Chapter 15 — A retrospection"
	  }
	]
  },
  {
    "title": "Thung Lũng Khủng Khiếp",
    "eTitle": "The Valley of Fear",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Tpd124",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Thung-Lung-Khung-Khiep-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/thung-lung-khung-khiep-mc-nu#fwdrapPlayer0?catid=8&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-vu-an-thung-lung-khung-khiep/"
    ],
    "grp": ["SH.A4$1", "SH.TDP124-TT", "SH.A4"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-vu-an-thung-lung-khung-khiep/Vụ án thung lũng khũng khiếp 1904_P(<*~~*>).mp3"
        }
      ]
    },
    "year": "1914-1915",
    "tap": [
      {"label": "Phần 1. Tấn bi kịch ở lâu đài Birlstone (Part I — The tragedy of Birlstone)", "f": 1, "t":  7},
      {"label": "Phần 2. Những người tiên phong (Part II — The scowrers)", "f": 8, "t": 14}
    ],
    "intro": "<b>Thung Lũng Khủng Khiếp</b> (Tiếng Anh: The Valley of Fear) là tiểu thuyết về Sherlock Holmes thứ tư và cũng là cuối cùng của Sir Arthur Conan Doyle. Câu chuyện được xuất bản lần đầu trên Tạp chí Strand Magazine từ tháng 9 năm 1914 đến tháng 5 năm 1915. Cuốn sách đầu tiên được đăng ký bản quyền vào năm 1914, và được xuất bản lần đầu tiên bởi Công ty George H. Doran ở New York vào ngày 27 tháng 2 năm 1915, và được minh họa bởi Arthur I. Keller.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Tin báo",
		"url": [""],
		"dur": "17:53",
		"cId": "A4.1",
		"eTit": "Chapter I — The warning"
	  },
	  {
		"stt": 2,
		"tit": "Sherlock Holmes diễn thuyết",
		"url": [""],
		"dur": "17:05",
		"cId": "A4.2",
		"eTit": "Chapter II — Sherlock Holmes discourses"
	  },
	  {
		"stt": 3,
		"tit": "Tấn bi kịch ở Birlstone",
		"url": [""],
		"dur": "20:51",
		"cId": "A4.3",
		"eTit": "Chapter III — The tragedy of Birlstone"
	  },
	  {
		"stt": 4,
		"tit": "Tối mò",
		"url": [""],
		"dur": "23:17",
		"cId": "A4.4",
		"eTit": "Chapter IV — Darkness"
	  },
	  {
		"stt": 5,
		"tit": "Những nhân vật của tấn thảm kịch",
		"url": [""],
		"dur": "27:19",
		"cId": "A4.5",
		"eTit": "Chapter V — The people of the drama"
	  },
	  {
		"stt": 6,
		"tit": "Tia sáng trong đêm đen",
		"url": [""],
		"dur": "23:30",
		"cId": "A4.6",
		"eTit": "Chapter VI — A dawning light"
	  },
	  {
		"stt": 7,
		"tit": "Giải đáp",
		"url": [""],
		"dur": "27:36",
		"cId": "A4.7",
		"eTit": "Chapter VII — The solution"
	  },
	  {
		"stt": 8,
		"tit": "Con người ấy",
		"url": [""],
		"dur": "15:08",
		"cId": "A4.8",
		"eTit": "Chapter I — The man"
	  },
	  {
		"stt": 9,
		"tit": "Người trưởng toán",
		"url": [""],
		"dur": "32:33",
		"cId": "A4.9",
		"eTit": "Chapter II — The Bodymaster"
	  },
	  {
		"stt": 10,
		"tit": "Chi nhánh 341 ở Vermissa",
		"url": [""],
		"dur": "34:47",
		"cId": "A4.10",
		"eTit": "Chapter III — Lodge 341, Vermissa"
	  },
	  {
		"stt": 11,
		"tit": "Thung lũng khủng khiếp",
		"url": [""],
		"dur": "20:32",
		"cId": "A4.11",
		"eTit": "Chapter IV — The Valley of Fear"
	  },
	  {
		"stt": 12,
		"tit": "Giờ đen tối",
		"url": [""],
		"dur": "20:03",
		"cId": "A4.12",
		"eTit": "Chapter V — The darkest hour"
	  },
	  {
		"stt": 13,
		"tit": "Nguy hiểm",
		"url": [""],
		"dur": "23:30",
		"cId": "A4.13",
		"eTit": "Chapter VI — Danger"
	  },
	  {
		"stt": 14,
		"tit": "Birdy sập bẫy",
		"url": [""],
		"dur": "17:03",
		"cId": "A4.14",
		"eTit": "Chapter VII — The trapping of Birdy Edwards"
	  }
	]
  },
  {
    "title": "Những cuộc phiêu lưu của Sherlock Holmes",
    "eTitle": "The Adventures of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Tpd124",
    "cover": "https://bizweb.dktcdn.net/thumb/1024x1024/100/370/339/products/img-8485.jpg?v=1691467038237",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/nhung-cuoc-phieu-luu-cua-sherlock-holmes#/fwdrapPlayer0?catid=6&trackid=12",
      "https://archive.org/details/kenhsachnoi.com-nhung-cuoc-phieu-luu-cua-sherlock-holmes",
      "https://www.lachoncoc.com/2015/05/blog-post_48.html",
      "https://archive.org/details/VienNgocBich",
      "https://www.lachoncoc.com/2015/05/blog-post_80.html",
      "https://archive.org/details/DaiBangLomom"
    ],
    "grp": ["SH.B$2", "SH.TDP124-TN", "SH.B"],
	"wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-nhung-cuoc-phieu-luu-cua-sherlock-holmes/<*~~*>"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/<*~~*>"
		  }
		],
	},
    "year": "1891-1892",
    "intro": "<b>Những cuộc phiêu lưu của Sherlock Holmes và bác sĩ Watson</b> (tiếng Anh: The adventures of Sherlock Holmes and Dr. Watson) là nhan đề hậu thế đặt cho loạt truyện xoay quanh hành trạng nhân vật thám tử Sherlock Holmes cùng cộng sự-bác sĩ Watson, do tác giả Arthur Conan Doyle sáng tác và ấn hành giai đoạn 1887 - 1927 tại London.<br/>Tác phẩm được coi là tiêu biểu nhất của dòng văn chương trinh thám và cũng thuộc số ít văn phẩm đặc trưng cho thời kì Victoria-Edward.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Vụ tai tiếng xứ Bohemia",
		"url": [
		  "01.Vụ tai tiếng xứ Bohemia 1891.mp3"         ,
		  "VienNgocBich/Vụ tai tiếng của xứ Bohemia.mp3"
		],
		"dur": "47:55",
		"cId": "B.1",
		"year": "1891",
		"eTit": "A Scandal in Bohemia"
	  },
	  {
		"stt": 2,
		"tit": "Hội tóc hung",
		"url": ["02.Hội tóc hung 1891.mp3", "DaiBangLomom/Hội Tóc Hung.mp3"],
		"dur": "46:06",
		"cId": "B.2",
		"year": "1891",
		"eTit": "The Red Headed League"
	  },
	  {
		"stt": 3,
		"tit": "Vụ mất tích kì lạ",
		"url": [
		  "03.Vụ mất tích kì lạ 1891.mp3"          ,
		  "DaiBangLomom/Một vụ mất tích kỳ lạ .mp3"
		],
		"dur": "34:14",
		"cId": "B.3",
		"year": "1891",
		"eTit": "A Case of Identity"
	  },
	  {
		"stt": 4,
		"tit": "Bí mật tại thung lũng Boscombe",
		"url": [
		  "04.Bí mật tại thung lũng Boscombe 1891.mp3"   ,
		  "VienNgocBich/Vụ án tại thung lũng Boscom .mp3"
		],
		"dur": "44:12",
		"cId": "B.4",
		"year": "1891",
		"eTit": "The Boscombe Valley Mystery"
	  },
	  {
		"stt": 5,
		"tit": "Năm hạt cam",
		"url": ["05.Năm hạt cam 1891.mp3", "DaiBangLomom/Năm Hột Cam.mp3"],
		"dur": "55:45",
		"cId": "B.5",
		"year": "1891",
		"eTit": "The Five Orange Pips"
	  },
	  {
		"stt": 6,
		"tit": "Người đàn ông môi trề",
		"url": [
		  "06.Người đàn ông môi trề 1891.mp3"     ,
		  "VienNgocBich/Người đàn ông môi trề.mp3"
		],
		"dur": "44:43",
		"cId": "B.6",
		"year": "1891",
		"eTit": "The Man with the Twisted Lip"
	  },
	  {
		"stt": 7,
		"tit": "Viên ngọc bích màu xanh da trời",
		"url": [
		  "07.Viên ngọc bích màu xanh da trời 1892.mp3",
		  "VienNgocBich/Viên Ngọc Bích.mp3"
		],
		"dur": "01:00:08",
		"cId": "B.7",
		"year": "1892",
		"eTit": "The Adventure of the Blue Carbuncle"
	  },
	  {
		"stt": 8,
		"tit": "Dải băng lốm đốm",
		"url": ["08.Dải băng lốm đốm 1892.mp3", "DaiBangLomom/Hội Tóc Hung.mp3"],
		"dur": "01:07:35",
		"cId": "B.8",
		"year": "1892",
		"eTit": "The Adventure of the Speckled Band"
	  },
	  {
		"stt": 9,
		"tit": "Ngón tay cái của viên kỹ sư",
		"url": [
		  "09.Ngón tay cái của viên Kỹ sư 1892.mp3"     ,
		  "VienNgocBich/Ngón tay cái của viên kỹ sư.mp3"
		],
		"dur": "59:55",
		"cId": "B.9",
		"year": "1892",
		"eTit": "The Adventure of the Engineer’s Thumb"
	  },
	  {
		"stt": 10,
		"tit": "Chàng quý tộc độc thân",
		"url": [
		  "10.Chàng quý tộc độc thân 1892.mp3"     ,
		  "DaiBangLomom/Chàng quý tộc độc thân.mp3"
		],
		"dur": "37:51",
		"cId": "B.10",
		"year": "1892",
		"eTit": "The Adventure of the Noble Bachelor"
	  },
	  {
		"stt": 11,
		"tit": "Chiếc vương miện gắn ngọc Berin",
		"url": [
		  "11.Chiếc vương miện gắn ngọc Berin 1892.mp3"       ,
		  "DaiBangLomom/Chiếc vương miện bằng ngọc Berin .mp3"
		],
		"dur": "48:38",
		"cId": "B.11",
		"year": "1892",
		"eTit": "The Adventure of the Beryl Coronet"
	  },
	  {
		"stt": 12,
		"tit": "Vùng đất những dây dẻ đỏ",
		"url": [
		  "12.Vùng đất những dây dẻ đỏ 1892.mp3"     ,
		  "VienNgocBich/Vùng đất những cây dẻ đỏ.mp3"
		],
		"dur": "50:21",
		"cId": "B.12",
		"year": "1892",
		"eTit": "The Adventure of the Copper Beeches"
	  }
	]},
  {
    "title": "Hồi Ức Về Shelock Holmes",
    "eTitle": "Memoirs of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Tpd124",
    "cover": "https://trinhdinhlinh.com/sach/wp-content/uploads/2018/01/downloadsach.com_nhung_ho-000.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/hoi-uc-ve-sherlock-holmes#/fwdrapPlayer0?catid=5&trackid=11",
      "https://archive.org/details/kenhsachnoi.com-nhung-hoi-uc-ve-sherlock-holmes",
      "https://www.lachoncoc.com/2015/05/blog-post_34.html#gsc.tab=0",
      "https://archive.org/details/CongViecSauCungCuaHolmes"
    ],
    "grp": ["SH.C$2", "SH.TDP124-TN", "SH.C"],
	"wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-nhung-hoi-uc-ve-sherlock-holmes/<*~~*>"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/<*~~*>"
		  }
		],
	},
    "year": "1892-1893",
    "intro": "<b>Hồi Ức Về Shelock Holmes</b> (Tiếng Anh: The Memoirs of Sherlock Holmes). Sherlock Holmes là một nhân vật thám tử hư cấu vào cuối thế kỉ 19 và đầu thế kỉ 20, xuất hiện lần đầu trong tác phẩm của nhà văn Arthur Conan Doyle xuất bản năm 1887.<br/>Ông là thám tử tư ở Luân Đôn nổi tiếng nhờ trí thông minh, khả năng suy diễn logic và quan sát tinh tường trong khi phá những vụ án mà cảnh sát phải bó tay. Nhiều người cho rằng Sherlock Holmes là nhân vật thám tử hư cấu nổi tiếng nhất trong lịch sử văn học và là một trong những nhân vật văn học được biết đến nhiều nhất trên toàn thế giới.",
	"parts": [
	  {
		"stt": 1,
		"tit": "Ngọn lửa bạc",
		"url": [
		  "01.Ngọn lửa bạc 1892.mp3"                 ,
		  "CongViecSauCungCuaHolmes/Ngọn lửa bạc.mp3"
		],
		"dur": "55:53",
		"cId": "C.1",
		"year": "1892",
		"eTit": "Silver Blaze"
	  },
	  {
		"stt": 2,
		"tit": "Gương mặt vàng vọt",
		"url": [
		  "02.Bộ mặt vàng vọt 1893.mp3"                 ,
		  "CongViecSauCungCuaHolmes/Bộ mặt vàng vọt.mp3"
		],
		"dur": "36:11",
		"cId": "C.2",
		"year": "1893",
		"eTit": "The Yellow Face"
	  },
	  {
		"stt": 3,
		"tit": "Người làm thuê cho nhà môi giới chứng khoán",
		"url": [
		  "03.Người làm thuê cho nhà môi giới chứng khoán 1893.mp3"      ,
		  null
		],
		"dur": "37:39",
		"cId": "C.3",
		"year": "1893",
		"eTit": "The Stock Broker’s Clerk"
	  },
	  {
		"stt": 4,
		"tit": "Con tàu Gloria Scott",
		"url": [
		  "04.Con tàu Gloria Scott 1893.mp3"   ,
		  null
		],
		"dur": "50:24",
		"cId": "C.4",
		"year": "1893",
		"eTit": "The Gloria Scott"
	  },
	  {
		"stt": 5,
		"tit": "Tục lệ nhà Musgrave",
		"url": [
		  "05.Tục lệ nhà Musgrave 1893.mp3",
		  null
		],
		"dur": "01:05:27",
		"cId": "C.5",
		"year": "1893",
		"eTit": "The Musgrave Ritual"
	  },
	  {
		"stt": 6,
		"tit": "Vụ án ở Reigate",
		"url": [
		  "06.Những nghiệp chủ ở Raigate 1893.mp3", null
		],
		"dur": "39:47",
		"cId": "C.6",
		"year": "1893",
		"eTit": "The Reigate Puzzle"
	  },
	  {
		"stt": 7,
		"tit": "Kẻ dị dạng",
		"url": [
		  "07.Kẻ dị dạng 1893.mp3"                  ,
		  "CongViecSauCungCuaHolmes/Kẻ dị dạng .mp3"
		],
		"dur": "29:28",
		"cId": "C.7",
		"year": "1893",
		"eTit": "The Crooked Man"
	  },
	  {
		"stt": 8,
		"tit": "Bệnh nhân thường trú",
		"url": [
		  "08.Bệnh nhân thường trú 1893.mp3"                 ,
		  "CongViecSauCungCuaHolmes/Bệnh nhân thường trú.mp3"
		],
		"dur": "38:09",
		"cId": "C.8",
		"year": "1893",
		"eTit": "The Resident Patient"
	  },
	  {
		"stt": 9,
		"tit": "Người thông ngôn Hy Lạp",
		"url": [
		  "09.Người thông ngôn Hy Lạp 1893.mp3", null
		],
		"dur": "35:17",
		"cId": "C.9",
		"year": "1893",
		"eTit": "The Greek Interpreter"
	  },
	  {
		"stt": 10,
		"tit": "Bản hiệp ước hải quân",
		"url": [
		  "10.Bản hiệp ước hải quân 1893.mp3"                 ,
		  "CongViecSauCungCuaHolmes/Bản hiếp ước hải quan.mp3"
		],
		"dur": "01:08:34",
		"cId": "C.10",
		"year": "1893",
		"eTit": "The Naval Treaty"
	  },
	  {
		"stt": 11,
		"tit": "Công việc cuối cùng của Sherlock Holmes",
		"url": [
		  "11.Công việc cuối cùng của Sherlock Holmes 1893.mp3"       ,
		  "CongViecSauCungCuaHolmes/Công việc sau cùng của Holmes.mp3"
		],
		"dur": "37:26",
		"cId": "C.11",
		"year": "1893",
		"eTit": "The Final Problem"
	  }
	]},
  {
    "title": "Sherlock Holmes Trở Về",
    "eTitle": "The Return of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Tpd124",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2021/12/Truyen-trinh-tham-Sherlock-Holmes-tro-ve-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/sherlock-holmes-tro-ve#/fwdrapPlayer0?catid=4&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-sherlockhome-tro-ve"
    ],
    "grp": ["SH.D$2", "SH.TDP124-TN", "SH.D"],
	"wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-sherlockhome-tro-ve/<*~~*>"
		  }
		],
	},
    "year": "1903-1904",
    "intro": "Sherlock Holmes trở về - The Return of Sherlock Holmes, bao gồm 13 truyện ngắn được đăng trên tờ The Strand từ năm 1903 đến 1904.<br/><b>Sherlock Holmes</b> đã xuất hiện trong 4 tiểu thuyết và 56 truyện ngắn của nhà văn Conan Doyle. Hầu như tất cả các tác phẩm đều được viết dưới dạng ghi chép của bác sĩ John H. Watson, người bạn thân thiết và người ghi chép tiểu sử của Holmes, chỉ có 2 tác phẩm được viết dưới dạng ghi chép của chính Holmes và 2 tác phẩm khác dưới dạng ghi chép của người thứ ba. Hai tác phẩm đầu tiên trong số này, 2 tiểu thuyết ngắn, xuất hiện lần đầu tiên trên tờ Beetons Christmas Annual năm 1887 và tờ Lippincotts Monthly Magazine năm 1890. Thám tử Holmes trở nên cực kì nổi tiếng khi loạt truyện ngắn của Doyle được xuất bản trên tạp chí The Strand Magazine năm 1891. Các tác phẩm được viết xoay quanh thời gian từ năm 1878 đến năm 1903 với vụ án cuối cùng vào năm 1914.",
    "parts": [
      {
        "stt": 1,
        "tit": "Ngôi nhà trống không",
        "url": "01.Ngôi nhà trống không 1903.mp3",
        "dur": "01:15:59",
        "cId": "D.1",
        "year": "1903",
        "eTit": "The Adventure of the Empty House"
      },
      {
        "stt": 2,
        "tit": "Nhà thầu khoáng ở Norwood",
        "url": "02.Nhà thầu khoáng ở Norwood 1903.mp3",
        "dur": "41:39",
        "cId": "D.2",
        "year": "1903",
        "eTit": "The Adventure of the Norwood Builder"
      },
      {
        "stt": 3,
        "tit": "Những hình nhân nhảy múa",
        "url": "03.Những hình nhân nhảy múa 1903.mp3",
        "dur": "59:38",
        "cId": "D.3",
        "year": "1903",
        "eTit": "The Adventure of the Dancing Men"
      },
      {
        "stt": 4,
        "tit": "Cô gái đi xe đạp",
        "url": "04.Cô gái đi xe đạp 1903.mp3",
        "dur": "44:17",
        "cId": "D.4",
        "year": "1903",
        "eTit": "The Adventure of the Solitary Cyclist"
      },
      {
        "stt": 5,
        "tit": "Câu chuyện tại ký túc xá",
        "url": "05.Câu chuyện tại Khu học xá 1903.mp3",
        "dur": "01:13:44",
        "cId": "D.5",
        "year": "1904",
        "eTit": "The Adventure of the Priory School"
      },
      {
        "stt": 6,
        "tit": "Peter hung bạo",
        "url": "06.Peter Hắc Ám 1904.mp3",
        "dur": "01:07:04",
        "cId": "D.6",
        "year": "1904",
        "eTit": "The Adventure of Black Peter"
      },
      {
        "stt": 7,
        "tit": "Tên tống tiền ngoại hạng",
        "url": "07.Tên Tống tiền ngoại hạng 1904.mp3",
        "dur": "41:28",
        "cId": "D.7",
        "year": "1904",
        "eTit": "The Adventure of Charles Augustus Milverton"
      },
      {
        "stt": 8,
        "tit": "Sáu bức tượng Napoleon",
        "url": "08.Cuộc phiêu lưu của Sáu bức tượng Napoleon 1904.mp3",
        "dur": "49:13",
        "cId": "D.8",
        "year": "1904",
        "eTit": "The Adventure of the Six Napoleons"
      },
      {
        "stt": 9,
        "tit": "Ba sinh viên",
        "url": "09.Ba sinh viên 1904.mp3",
        "dur": "39:13",
        "cId": "D.9",
        "year": "1904",
        "eTit": "The Adventure of the Three Students"
      },
      {
        "stt": 10,
        "tit": "Cái kính kẹp mũi bằng vàng",
        "url": "10.Cái kính kẹp mũi bằng vàng 1904.mp3",
        "dur": "01:06:13",
        "cId": "D.10",
        "year": "1904",
        "eTit": "The Adventure of the Golden Pince-Nez"
      },
      {
        "stt": 11,
        "tit": "Một trung vệ bị mất tích",
        "url": "11.Một trung vệ bị mất tích 1904.mp3",
        "dur": "46:12",
        "cId": "D.11",
        "year": "1904",
        "eTit": "The Adventure of the Missing Three-Quarter"
      },
      {
        "stt": 12,
        "tit": "Vụ án tại Abbey Grange",
        "url": "12.Vụ án tại Abbey Grange 1904.mp3",
        "dur": "59:04",
        "cId": "D.12",
        "year": "1904",
        "eTit": "The Adventure of the Abbey Grange"
      },
      {
        "stt": 13,
        "tit": "Vết máu thứ hai",
        "url": "13.Vết máu thứ hai 1904.mp3",
        "dur": "01:06:02",
        "cId": "D.13",
        "year": "1904",
        "eTit": "The Adventure of the Second Stain"
      }
    ]
  },
  {
    "title": "Cung đàn sau cuối",
    "eTitle": "His Last Bow",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Tpd124",
    "cover": "https://theliteraryomnivore.wordpress.com/wp-content/uploads/2013/02/doylehislastbow.jpeg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/cung-dan-sau-cuoi#fwdrapPlayer0?catid=3&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-cung-dan-sau-cuoi-mckhac",
      "https://www.lachoncoc.com/2015/05/blog-post_94.html#gsc.tab=0",
      "https://archive.org/details/SherlokHolmesHapHoi",
      "https://archive.org/details/CacBanVeTauNgamBrucePartington"
    ],
    "grp": ["SH.E$2", "SH.TDP124-TN", "SH.E"],
	"wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-cung-dan-sau-cuoi-mckhac/<*~~*>"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "https://archive.org/download/<*~~*>"
		  }
		],
	},
    "year": "1908-1917",
    "intro": "<b>Cung đàn sau cuối</b> (Tiếng Anh: His Last Bow). Bà Hudson, chủ nhà trọ của Sherlock Holmes là người cực kỳ kiên nhẫn. Chẳng những căn hộ của Holmes lúc nào cung đày ấp những người quái dị, mà Holmes lại lôi thôi lếch thếch cực cùng, sự ghiền nhạc vào giờ ngủ của mọi người, thói quen tập bắn súng lục trong phòng, các cuộc thử nghiệm hóa họa vừa kỳ lạ, vừa hôi thối, các thô bạo và nguy hiểm bao quanh biến anh thành người thuê nhà bê bối nhất tại London.",
    "parts": [
      {
        "stt": 1,
        "tit": "Đêm kinh hoàng ở điền trang Wisteria",
        "url": [
          "01.Đêm Kinh Hoàng ở điền trang Wisteria.mp3",
          "SherlokHolmesHapHoi/Đêm Kinh Hoàng ở điền trang Wisteria.mp3"
        ],
        "dur": "01:00:48",
        "cId": "E.1",
        "year": "1908",
        "eTit": "The Adventure of Wisteria Lodge"
      },
      {
        "stt": 2,
        "tit": "Vòng tròn đỏ",
        "url": [
          "03.Vòng tròn đỏ 1911.mp3",
          "SherlokHolmesHapHoi/Vòng tròn đỏ.mp3"
        ],
        "dur": "52:57",
        "cId": "E.2",
        "year": "1911",
        "eTit": "The Adventure of the Red Circle"
      },
      {
        "stt": 3,
        "tit": "Hai lỗ tai trong hộp các tông",
        "url": [
          "02.Hai lỗ tai người trong hộp cạc tông 1893.mp3",
          "SherlokHolmesHapHoi/Hai lỗ tai người trong hộp cạc tông.mp3"
        ],
        "dur": "45:26",
        "cId": "E.3",
        "year": "1893",
        "eTit": "The Adventure of the Cardboard Box"
      },
      {
        "stt": 4,
        "tit": "Các bản vẽ tàu ngầm Bruce Partington",
        "url": [
          "04.Các bản vẽ tàu ngầm Bruce Partington 1908.mp3",
          "CacBanVeTauNgamBrucePartington/Các bản vẽ tàu ngầm Bruce Partington.mp3"
        ],
        "dur": "01:18:13",
        "cId": "E.4",
        "year": "1908",
        "eTit": "The Adventure of the Bruce-Partington Plans"
      },
      {
        "stt": 5,
        "tit": "Sherlock Holmes hấp hối",
        "url": [
          "05.Sherlock Holmes hấp hối 1913.mp3",
          "SherlokHolmesHapHoi/Sherlok Holmes hấp hối.mp3"
        ],
        "dur": "32:45",
        "cId": "E.5",
        "year": "1913",
        "eTit": "The Adventure of the Dying Detective"
      },
      {
        "stt": 6,
        "tit": "Quý bà mất tích",
        "url": [
          "06.Quý bà Frances Carfax mất tích 1911.mp3",
          "CacBanVeTauNgamBrucePartington/Quý bà Frances Carfax mất tích.mp3"
        ],
        "dur": "58:52",
        "cId": "E.6",
        "year": "1911",
        "eTit": "The Disappearance of Lady Frances Carfax"
      },
      {
        "stt": 7,
        "tit": "Bàn chân của quỷ",
        "url": [
          "07.Bàn chân của quỷ 1910.mp3",
          "CacBanVeTauNgamBrucePartington/Bàn chân của quỷ.mp3"
        ],
        "dur": "01:05:05",
        "cId": "E.7",
        "year": "1910",
        "eTit": "The Adventure of the Devil’s Foot"
      },
      {
        "stt": 8,
        "tit": "Cung đàn sau cuối",
        "url": [
          "08.Cung đàn sau cuối 1917.mp3",
          "CacBanVeTauNgamBrucePartington/Cung đàn sau cuối.mp3"
        ],
        "dur": "44:52",
        "cId": "E.8",
        "year": "1917",
        "eTit": "His Last Bow"
      }
    ]
  },
  {
    "title": "Tàng thư Sherlock Holmes",
    "eTitle": "The Case Book of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập truyện ngắn",
    "mc": "Tpd124",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2022/02/Truyen-trinh-tham-Tang-thu-Sherlock-Holmes-Full-MP3-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/tang-thu-sherlock-holmes#/fwdrapPlayer0?catid=1&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-tangthu-sherlock-holmes"
    ],
    "grp": ["SH.F$2", "SH.TDP124-TN", "SH.F"],
	"wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/kenhsachnoi.com-tangthu-sherlock-holmes/<*~~*>"
		  }
		],
	},
    "year": "1921-1927",
    "intro": "<b>Tàng thư của Sherlock Holmes</b> (Tiếng Anh: The Case Book of Sherlock Holmes) là lời nói đầu mà Conan Doyle mượn lời bác sĩ Watson cũng là một lời chia tay thực sự của Holmes với độc giả khắp nơi. <b>Sherlock Holmes</b> là một tác phẩm trinh thám vĩ đại, có thể nói nó là tác phẩm hay nhất của thể loại đòi hỏi óc sáng tạo và tầm hiểu biết  rộng lớn này. Conan Doyle là nhà văn vĩ đại, ông cũng như đứa con tinh thần Sherlock Holmes của mình sẽ còn sống mãi trong lòng triệu triệu độc giả thế giới.",
    "parts": [
      {
        "stt": 1,
        "tit": "Người khách hàng nổi tiếng",
        "url": "01.Người khách hàng nổi tiếng 1924.mp3",
        "dur": "01:03:38",
        "cId": "F.1",
        "year": "1924",
        "eTit": "The Adventure of the Illustrious Client"
      },
      {
        "stt": 2,
        "tit": "Người lính bị vảy nến",
        "url": "02.Người lính bị vảy nến 1926.mp3",
        "dur": "49:00",
        "cId": "F.2",
        "year": "1926",
        "eTit": "The Adventure of the Blanched Soldier"
      },
      {
        "stt": 3,
        "tit": "Viên đá của Mazarin",
        "url": "03.Viên đá của Mazarin 1921.mp3",
        "dur": "44:27",
        "cId": "F.3",
        "year": "1921",
        "eTit": "The Adventure of the Mazarin Stone"
      },
      {
        "stt": 4,
        "tit": "Ba đầu hồi",
        "url": "04.Ba đầu hồi 1926.mp3",
        "dur": "48:14",
        "cId": "F.4",
        "year": "1926",
        "eTit": "The Adventure of the Three Gables"
      },
      {
        "stt": 5,
        "tit": "Ma cà rồng vùng Sussex",
        "url": "05.Ma cà rồng vùng Sussex 1924.mp3",
        "dur": "42:50",
        "cId": "F.5",
        "year": "1924",
        "eTit": "The Adventure of the Sussex Vampire"
      },
      {
        "stt": 6,
        "tit": "Ba nguời họ Garridebs",
        "url": "06.Ba nguời họ Garridebs 1924.mp3",
        "dur": "41:22",
        "cId": "F.6",
        "year": "1924",
        "eTit": "The Adventure of the Three Garridebs"
      },
      {
        "stt": 7,
        "tit": "Bài toán cầu Thor",
        "url": "07.Bài toán cầu Thor 1922.mp3",
        "dur": "01:02:12",
        "cId": "F.7",
        "year": "1922",
        "eTit": "The Problem of Thor Bridge"
      },
      {
        "stt": 8,
        "tit": "Người đi bốn chân",
        "url": "08.Người đi 4 chân 1923.mp3",
        "dur": "50:44",
        "cId": "F.8",
        "year": "1923",
        "eTit": "The Adventure of the Creeping Man"
      },
      {
        "stt": 9,
        "tit": "Cái bờm sư tử",
        "url": "09.Cái bờm sư tử 1926.mp3",
        "dur": "49:17",
        "cId": "F.9",
        "year": "1926",
        "eTit": "The Adventure of the Lions Mane"
      },
      {
        "stt": 10,
        "tit": "Bà thuê nhà mang mạng che",
        "url": "10.Bà thuê nhà mang mạng che 1927.mp3",
        "dur": "31:46",
        "cId": "F.10",
        "year": "1927",
        "eTit": "The Adventure of the Veiled Lodger"
      },
      {
        "stt": 11,
        "tit": "Bí ẩn lâu đài Shoscombe",
        "url": "11.Bí ẩn lâu đài Shoscombe 1927.mp3",
        "dur": "41:55",
        "cId": "F.11",
        "year": "1927",
        "eTit": "The Adventure of Shoscombe Old Place"
      },
      {
        "stt": 12,
        "tit": "Người bán sơn về hưu",
        "url": "12.Người bán sơn về hưu 1926.mp3",
        "dur": "35:27",
        "cId": "F.12",
        "year": "1926",
        "eTit": "The Adventure of the Retired Colourman"
      }
    ]
  },
  
  {
    "title": "Những vụ kỳ án của Sherlock Holmes",
    "eTitle": "Sherlock Holmes: The Difficult Cases",
    "author": "Arthur Conan Doyle",
    "mc": "Quốc Bình",
    "type": "Tuyển tập (Loạt truyện)",
    "cover": "https://product.hstatic.net/1000237375/product/nhung-vu-ky-an-cua-sherlock-holmes-14934-500_master.jpg",
    "ssrc": [
      "https://archive.org/details/nhungvukyancuasherlockholmes04",
      "https://phatphapungdung.com/sach-noi/nhung-vu-ki-an-cua-sherlock-holmes-178239.html",
      "https://sachnoi.vip/nhung-vu-ki-an-cua-sherlock-holmes/"
    ],
    "grp": ["SH.G1$3", "SH.OTHERS", "SH.G"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/truyen-dai-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Nhung-Vu-Ky-An-Cua-Sherlock-Holmes-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/nhungvukyancuasherlockholmes04/Nhung-Vu-Ky-An-Cua-Sherlock-Holmes<*~~*>.mp3"
        }
      ]
    },
    "year": "1867-1927",
    "intro": "Sir Arthur Conan Doyle đã viết nhiều câu truyện về Sherlock Holmes bắt đầu xuất hiện lần đầu tiên vào năm 1887 trong cuốn tiểu thuyết trinh thám 'A Study in Scarlet'. Từ đó, nhà văn Anh đã viết 4 tiểu thuyết và 55 truyện ngắn về Holmes.<br/>Tập truyện này tuyển chọn những vụ án khó khăn nhất của Sherlock Holmes như: Ngón tay cái của viên kỹ sư, Chàng quý tộc độc thân, Kẻ dị dạng, Bệnh nhân thường trú, Người thông ngôn Hy Lạp, Bản hiệp ước hải quân, Công việc cuối cùng của Sherlock Holmes,...",
    "parts": [
      {
        "stt": 1,
        "tit": "Chàng quý tộc độc thân",
        "url": ["", ""],
        "cId": "B.10",
        "year": "1892",
        "eTit": "The Adventure of the Noble Bachelor",
        "dur": "35:23"
      },
      {
        "stt": 2,
        "tit": "Năm hạt cam",
        "url": ["", ""],
        "cId": "B.5",
        "year": "1891",
        "eTit": "The Five Orange Pips",
        "dur": "27:49"
      },
      {
        "stt": 3,
        "tit": "Người đàn ông môi trề",
        "url": ["", ""],
        "cId": "B.6",
        "year": "1891",
        "eTit": "The Man with the Twisted Lip",
        "dur": "36:36"
      },
      {
        "stt": 4,
        "tit": "Ngón tay cái của viên kỹ sư",
        "url": ["", ""],
        "cId": "B.9",
        "year": "1892",
        "eTit": "he Adventure of the Engineer’s Thumb",
        "dur": "44:51"
      },
      {
        "stt": 5,
        "tit": "Chiếc vương miện gắn ngọc Berin",
        "url": ["", ""],
        "cId": "B.11",
        "year": "1892",
        "eTit": "The Adventure of the Beryl Coronet",
        "dur": "43:29"
      },
      {
        "stt": 6,
        "tit": "Hội tóc hung",
        "url": ["", ""],
        "cId": "B.2",
        "year": "1891",
        "eTit": "The Red Headed League",
        "dur": "34:43"
      },
      {
        "stt": 7,
        "tit": "Vụ tai tiếng xứ Bohemia",
        "url": ["", ""],
        "cId": "B.1",
        "year": "1891",
        "eTit": "A Scandal in Bohemia",
        "dur": "35:11"
      },
      {
        "stt": 8,
        "tit": "Dải băng lốm đốm",
        "url": ["", ""],
        "cId": "B.8",
        "year": "1892",
        "eTit": "The Adventure of the Speckled Band",
        "dur": "42:33"
      },
      {
        "stt": 9,
        "tit": "Viên ngọc bích màu xanh da trời",
        "url": ["", ""],
        "cId": "B.7",
        "year": "1892",
        "eTit": "The Adventure of the Blue Carbuncle",
        "dur": "44:44"
      },
      {
        "stt": 10,
        "tit": "Cô gái đi xe đạp",
        "url": ["", ""],
        "cId": "D.4",
        "year": "1903",
        "eTit": "The Adventure of the Solitary Cyclist",
        "dur": "30:50"
      },
      {
        "stt": 11,
        "tit": "Peter hung bạo",
        "url": ["", ""],
        "cId": "D.6",
        "year": "1904",
        "eTit": "The Adventure of Black Peter",
        "dur": "35:52"
      },
      {
        "stt": 12,
        "tit": "Người thông ngôn Hy Lạp",
        "url": ["", ""],
        "cId": "C.9",
        "year": "1893",
        "eTit": "The Greek Interpreter",
        "dur": "27:16"
      },
      {
        "stt": 13,
        "tit": "Nhà thầu khoáng ở Norwood",
        "url": ["", ""],
        "cId": "D.2",
        "year": "1903",
        "eTit": "The Adventure of the Norwood Builder",
        "dur": "38:50"
      },
      {
        "stt": 14,
        "tit": "Công việc cuối cùng của Sherlock Holmes",
        "url": ["", ""],
        "cId": "C.11",
        "year": "1893",
        "eTit": "The Final Problem",
        "dur": "31:07"
      },
      {
        "stt": 15,
        "tit": "Ngôi nhà trống không",
        "url": ["", ""],
        "cId": "D.1",
        "year": "1903",
        "eTit": "The Adventure of the Empty House",
        "dur": "35:26"
      },
      {
        "stt": 16,
        "tit": "Ngọn lửa bạc",
        "url": ["", ""],
        "cId": "C.1",
        "year": "1892",
        "eTit": "Silver Blaze",
        "dur": "44:24"
      },
      {
        "stt": 17,
        "tit": "Sáu bức tượng Napoleon",
        "url": ["", ""],
        "cId": "D.8",
        "year": "1904",
        "eTit": "The Adventure of the Six Napoleons",
        "dur": "30:33"
      },
      {
        "stt": 18,
        "tit": "Cái kính kẹp mũi bằng vàng",
        "url": ["", ""],
        "cId": "D.10",
        "year": "1904",
        "eTit": "The Adventure of the Golden Pince-Nez",
        "dur": "41:35"
      },
      {
        "stt": 19,
        "tit": "Người làm thuê cho nhà môi giới chứng khoán",
        "url": ["", ""],
        "cId": "C.3",
        "year": "1893",
        "eTit": "The Stock Broker’s Clerk",
        "dur": "26:47"
      },
      {
        "stt": 20,
        "tit": "Bàn chân của quỷ",
        "url": ["", ""],
        "cId": "E.7",
        "year": "1910",
        "eTit": "The Adventure of the Devil’s Foot",
        "dur": "40:00"
      },
      {
        "stt": 21,
        "tit": "Ba sinh viên",
        "url": ["", ""],
        "cId": "D.9",
        "year": "1904",
        "eTit": "The Adventure of the Three Students",
        "dur": "28:28"
      },
      {
        "stt": 22,
        "tit": "Bệnh nhân thường trú",
        "url": ["", ""],
        "cId": "C.8",
        "year": "1893",
        "eTit": "The Resident Patient",
        "dur": "26:24"
      },
      {
        "stt": 23,
        "tit": "Người đi bốn chân",
        "url": ["", ""],
        "cId": "F.8",
        "year": "1923",
        "eTit": "The Adventure of the Creeping Man",
        "dur": "33:01"
      },
      {
        "stt": 24,
        "tit": "Ma cà rồng vùng Sussex",
        "url": ["", ""],
        "cId": "F.5",
        "year": "1924",
        "eTit": "The Adventure of the Sussex Vampire",
        "dur": "27:43"
      },
      {
        "stt": 25,
        "tit": "Bà thuê nhà mang mạng che",
        "url": ["", ""],
        "cId": "F.10",
        "year": "1927",
        "eTit": "The Adventure of the Veiled Lodger",
        "dur": "20:14"
      },
      {
        "stt": 26,
        "tit": "Hai lỗ tai trong hộp các tông",
        "url": ["", ""],
        "cId": "E.3",
        "year": "1893",
        "eTit": "The Adventure of the Cardboard Box",
        "dur": "29:19"
      },
      {
        "stt": 27,
        "tit": "Vụ án ở Reigate",
        "url": ["", ""],
        "cId": "C.6",
        "year": "1893",
        "eTit": "The Reigate Puzzle",
        "dur": "31:14"
      },
      {
        "stt": 28,
        "tit": "Bí ẩn lâu đài Shoscombe",
        "url": ["", ""],
        "cId": "F.11",
        "year": "1927",
        "eTit": "The Adventure of Shoscombe Old Place",
        "dur": "26:57"
      },
      {
        "stt": 29,
        "tit": "Bài toán cầu Thor",
        "url": ["", ""],
        "cId": "F.7",
        "year": "1922",
        "eTit": "The Problem of Thor Bridge",
        "dur": "36:39"
      },
      {
        "stt": 30,
        "tit": "Đêm kinh hoàng ở điền trang Wisteria",
        "url": ["", ""],
        "cId": "E.1",
        "year": "1908",
        "eTit": "The Adventure of Wisteria Lodge",
        "dur": "44:44"
      },
      {
        "stt": 31,
        "tit": "Tục lệ nhà Musgrave",
        "url": ["", ""],
        "cId": "C.5",
        "year": "1893",
        "eTit": "The Musgrave Ritual",
        "dur": "29:02"
      },
      {
        "stt": 32,
        "tit": "Người bán sơn về hưu",
        "url": ["", ""],
        "cId": "F.12",
        "year": "1926",
        "eTit": "The Adventure of the Retired Colourman",
        "dur": "22:55"
      },
      {
        "stt": 33,
        "tit": "Người khách hàng nổi tiếng",
        "url": ["", ""],
        "cId": "F.1",
        "year": "1924",
        "eTit": "The Adventure of the Illustrious Client",
        "dur": "38:10"
      },
      {
        "stt": 34,
        "tit": "Vết máu thứ hai",
        "url": ["", ""],
        "cId": "D.13",
        "year": "1904",
        "eTit": "The Adventure of the Second Stain",
        "dur": "41:48"
      },
      {
        "stt": 35,
        "tit": "Sherlock Holmes hấp hối",
        "url": ["", ""],
        "cId": "E.5",
        "year": "1913",
        "eTit": "The Adventure of the Dying Detective",
        "dur": "31:22"
      }
    ]
  },
  {
    "title": "Sherlock Holmes Toàn Tập - Tập 1",
    "eTitle": "Sherlock Holmes - The Complete Collection - Volume 1",
    "author": "Arthur Conan Doyle",
    "type": "Tuyển tập (Loạt truyện)",
    "mc": "Bá Trung",
    "cover": "https://i0.wp.com/sachnoiviet.net/wp-content/uploads/2021/11/sherlock-holmes-tron-bo-3-tap1.jpg",
    "ssrc": [
      "https://sachnoiviet.net/sach-noi/sherlock-holmes-tron-bo-3-tap",
      "https://archive.org/details/sherlock-1-05"                     ,
      "https://archive.org/details/sherlock-2-04"                     ,
      "https://archive.org/details/sherlock-3-05"
    ],
    "grp": ["SH.G2$3", "SH.OTHERS", "SH.G"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/sherlock-1-05/Sherlock-1-<*~~*>.mp3"
        }
      ]
    },
    "year": "1867-1927",
    "intro": "<b>Sherlock Holmes Toàn Tập</b> (Tiếng Anh: Sherlock Holmes - The Complete Collection). <b>Sherlock Holmes</b> có ngoại hình khó bắt mắt với dáng vẻ cao lòng khòng, gương mặt hơi lạnh lùng, không sinh động, có không ít tật xấu: Luộm thuộm, bừa bãi, nghiện thuốc lá nặng, thậm chí còn sử dụng cả morphine và Song nếu kiên nhẫn bám sát hành trình của tất cả các vụ án trong tuyển tập Sherlock Holmes, chúng ta sẽ thấy đằng sau vẻ ngoài bình thường ấy là một trí tuệ sắc sảo, khả năng tư duy logic cự phách, con mắt quan sát tinh tường…",
    "parts": [
      {
        "stt": 1,
        "tit": "Vụ mất tích kì lạ",
        "url": [""],
        "dur": "34:14",
        "cId": "B.3",
        "year": "1891",
        "eTit": "A Case of Identity"
      },
      {
        "stt": 2,
        "tit": "Chàng quý tộc độc thân",
        "url": [""],
        "dur": "37:51",
        "cId": "B.10",
        "year": "1892",
        "eTit": "The Adventure of the Noble Bachelor"
      },
      {
        "stt": 3,
        "tit": "Bí mật tại thung lũng Boscombe",
        "url": [""],
        "dur": "44:12",
        "cId": "B.4",
        "year": "1891",
        "eTit": "The Boscombe Valley Mystery"
      },
      {
        "stt": 4,
        "tit": "Kẻ dị dạng",
        "url": [""],
        "dur": "29:28",
        "cId": "C.7",
        "year": "1893",
        "eTit": "The Crooked Man"
      },
      {
        "stt": 5,
        "tit": "Chiếc vương miện gắn ngọc Berin",
        "url": [""],
        "dur": "48:38",
        "cId": "B.11",
        "year": "1892",
        "eTit": "The Adventure of the Beryl Coronet"
      },
      {
        "stt": 6,
        "tit": "Bệnh nhân thường trú",
        "url": [""],
        "dur": "28:58",
        "cId": "C.8",
        "year": "1893",
        "eTit": "The Resident Patient"
      },
      {
        "stt": 7,
        "tit": "Công việc cuối cùng của Sherlock Holmes",
        "url": [""],
        "dur": "37:26",
        "cId": "C.11",
        "year": "1893",
        "eTit": "The Final Problem"
      },
      {
        "stt": 8,
        "tit": "Ngôi nhà trống không",
        "url": [""],
        "dur": "39:00",
        "cId": "D.1",
        "year": "1903",
        "eTit": "The Adventure of the Empty House"
      },
      {
        "stt": 9,
        "tit": "Nhà thầu khoáng ở Norwood",
        "url": [""],
        "dur": "41:39",
        "cId": "D.2",
        "year": "1903",
        "eTit": "The Adventure of the Norwood Builder"
      },
      {
        "stt": 10,
        "tit": "Sherlock Holmes hấp hối",
        "url": [""],
        "dur": "32:45",
        "cId": "E.5",
        "year": "1913",
        "eTit": "The Adventure of the Dying Detective"
      }
    ]
  },
  {
    "title": "Chiếc Nhẫn Tình Cờ",
    "eTitle": "A Study in Scarlet",
    "author": "Arthur Conan Doyle",
    "type": "Tiểu thuyết",
    "mc": "Hồng Trinh",
    "cover": "https://i0.wp.com/sachnoiviet.net/wp-content/uploads/2022/04/chiec-nhan-tinh-co.jpg",
    "ssrc": "https://sachnoiviet.net/sach-noi/chiec-nhan-tinh-co",
    "grp": ["SH.A1$1", "SH.OTHERS", "SH.A1"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 1,
          "wcSrc": "https://archive.org/download/chiec-nhan-1_202204/chiec-nhan-<*~~*>.mp3"
        }
      ]
    },
    "year": "1887",
    "intro": "Những ai đam mê tiểu thuyết trinh thám chắc chắn không thể không biết đến bộ truyện “Sherlock Holmes” bất hủ. <b>Chiếc Nhẫn Tình Cờ</b> (Tiếng Anh: A Study in Scarlet ) chính là một trong những vụ án xuất sắc nhất trong sự nghiệp phá án của Sherlock Holmes. Arthur Conan Doyle là một tác giả người Scotland, ông được biết đến với tiểu thuyết “Sherlock Holmes” được xem là tác phẩm đi tiên phong trong thể loại trinh thám. Ông đã từng theo học ngành y, thậm chí còn mở cho mình một phòng khám riêng. Thế vì niềm đam mê văn học luôn bùng cháy trong ông, ông đã quyết định bắt tay vào sáng tác và cho ra đời tác phẩm “Sherlock Holmes” bất hủ.",
    "parts": [
      {
        "stt": 1,
        "tit": "Chiếc Nhẫn Tình Cờ 1",
        "url": [""],
        "dur": "1:00:00"
      },
      {
        "stt": 2,
        "tit": "Chiếc Nhẫn Tình Cờ 2",
        "url": [""],
        "dur": "1:00:00"
      },
      {
        "stt": 3,
        "tit": "Chiếc Nhẫn Tình Cờ 3",
        "url": [""],
        "dur": "1:00:00"
      },
      {
        "stt": 4,
        "tit": "Chiếc Nhẫn Tình Cờ 4",
        "url": [""],
        "dur": "26:36"
      }
    ]
  },
  {
    "title": "Chuyện không công bố của Sherlock Holmes",
    "eTitle": "Untold Story of Shelock Holmes",
    "author": "Enleri Kuin",
    "type": "Tiểu thuyết",
    "mc": "Tpd124?",
    "cover": "https://img.dtruyen.com/public/images/large/chuyenkhongcongbocuasherlockholmes28Psl5yxM5.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/chuyen-chua-cong-bo-mc-nu#/fwdrapPlayer0?catid=7&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-chuyen-chua-cong-bo"
    ],
    "grp": ["SH.G3$3", "SH.OTHERS", "SH.G"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-chuyen-chua-cong-bo/Kẻ-mổ-bụng-P(<*~~*>)-(KenhSachNoi.Com).mp3"
        }
      ]
    },
    "year": "",
    "intro": "<b>Chuyện không công bố của Sherlock Holmes (Bản ghi chép chưa ai biết của bác sĩ Watson)</b> của Tác giả Enleri (Dịch giả: Ngọc Châu) Kuin xoay quanh những câu chuyện ly kỳ và phức tạp về cuộc phiêu lưu của nhà thám tử tài ba Sherlock Holmes và đồng sự trung thành của ông, bác sĩ John Watson. Cuốn sách mở đầu bằng việc Sherlock Holmes nhận được một vụ án mạng đầy bí ẩn và ly kỳ, khiến ông phải sử dụng tất cả trí tuệ và sự thông minh của mình để phá giải vụ án. Từ đó, cuộc hành trình điều tra của Holmes và Watson bắt đầu, đưa họ đến những nơi kỳ bí và gặp gỡ những nhân vật đầy bí ẩn.",
    "parts": [
      {
        "stt": 1,
        "tit": "Bộ đồ mổ",
        "url": [""],
        "dur": "33:09"
      },
      {
        "stt": 2,
        "tit": "Lâu đài bên đầm lầy",
        "url": [""],
        "dur": "33:33"
      },
      {
        "stt": 3,
        "tit": "Khu Waitrepen",
        "url": [""],
        "dur": "28:38"
      },
      {
        "stt": 4,
        "tit": "Chỗ ở của bác sĩ Meray",
        "url": [""],
        "dur": "21:38"
      },
      {
        "stt": 5,
        "tit": "Câu lạc bộ Diogenes",
        "url": [""],
        "dur": "26:11"
      },
      {
        "stt": 6,
        "tit": "Tôi theo dõi kẻ mổ bụng",
        "url": [""],
        "dur": "29:56"
      },
      {
        "stt": 7,
        "tit": "Đồ tể ở lò mổ",
        "url": [""],
        "dur": "23:01"
      },
      {
        "stt": 8,
        "tit": "Người khách Paris",
        "url": [""],
        "dur": "21:22"
      },
      {
        "stt": 9,
        "tit": "Hang ổ của kẻ mổ bụng",
        "url": [""],
        "dur": "20:24"
      },
      {
        "stt": 10,
        "tit": "Con hổ ở 'thiên thần và vương miện'",
        "url": [""],
        "dur": "23:43"
      },
      {
        "stt": 11,
        "tit": "Cái chết của Risa Sairx",
        "url": [""],
        "dur": "11:01"
      },
      {
        "stt": 12,
        "tit": "Đoạn kết của Jack mổ bụng",
        "url": [""],
        "dur": "13:29"
      }
    ]
  }
]};

const hpData = {
"meta" : {
	"name" : "Harry Potter",
	"eName" : "Harry Potter",
	"bookGrp" : [
		[ {"label": "Harry Potter" , "gId": "$4"} ],
		[ {"label": "Harry Potter", "gId": "HP.DLND"} ],
		[ {"label": "Harry Potter", "gId": "HP.DLND"} ]
	]
},
"books": [
  {
    "title": "Quyển 1. Harry Potter và Hòn đá phù thuỷ",
    "eTitle": "Harry Potter and the Sorcerer's Stone",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Đồng Linh, Nam Dương",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/5/51/Harry_Potter_và_Hòn_đá_phù_thủy_bìa_2003.jpeg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-tap-1-177589.html",
      "https://audioaz.com/en/audiobook/harry-potter-va-hon-da-phu-thuy-tap-1",
      "https://archive.org/details/harry-potter-va-hon-da-phu-thuy-tap-1.sna/HarryPotterTap1HonDaPhuThuy01_2.mp3",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhZRGr2hyBcUSmFXBMuVPc9O",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATAlOk1uzARIGo3NWfe7Zs70",
      "https://www.youtube.com/@BookLand90/videos"
    ],
    "grp": ["HP.TAP1$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-1-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-hon-da-phu-thuy-tap-1.sna/HarryPotterTap1HonDaPhuThuy<*~~*>_2.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLdh4dk0fbkhZRGr2hyBcUSmFXBMuVPc9O"
    },
    "year": 1997,
    "intro": "<b>Harry Potter và Hòn đá Phù thủy</b> (nguyên tác: Harry Potter and the Philosopher's Stone) là tiểu thuyết kỳ ảo của văn sĩ người Anh J. K. Rowling. Đây là cuốn đầu trong series tiểu thuyết Harry Potter và là tiểu thuyết đầu tay của J. K. Rowling. Nội dung sách kể về Harry Potter, một phù thủy thiếu niên chỉ biết về tiềm năng phép thuật của mình sau khi nhận thư mời nhập học tại Học viện Ma thuật và Pháp thuật Hogwarts vào đúng dịp sinh nhật thứ mười một. Ngay năm học đầu tiên, Harry đã có những người bạn thân lẫn những đối thủ ở trường như Ron Weasly, Hermione Granger, Draco Malfoy,.... Được bạn bè giúp sức, Harry chiến đấu chống lại sự trở lại của Chúa tể Hắc ám Voldemort, kẻ đã sát hại cha mẹ cậu nhưng lại thảm bại khi toan giết Harry dù cậu khi đó chỉ mới 15 tháng tuổi.<br>Sách được Bloomsbury xuất bản lần đầu tại Anh Quốc vào năm 1997. Năm 1998, Scholastic Corporation xuất bản tác phẩm tại Hoa Kỳ với nhan đề Harry Potter and the Sorcerer's Stone (Harry Potter và Hòn đá Phù thủy) và có chút thay đổi về văn phong để phù hợp với độc giả Mỹ; bản dịch tiếng Việt của Nhà xuất bản Trẻ cũng dựa trên ấn bản này.<br><i>Harry Potter và Hòn đá Phù thủy</i> giành hầu hết các giải thưởng về sách ở Anh Quốc do trẻ em bầu chọn cũng như một số giải thưởng khác ở Hoa Kỳ. Tác phẩm đứng đầu danh sách tiểu thuyết bán chạy nhất trong tháng 8 năm 1999 của Thời báo New York và liên tục nằm trong top đầu của danh sách này trong suốt gần hai năm tiếp theo (1999 và 2000). Truyện đã được dịch ra ít nhất bảy mươi tư thứ tiếng cũng như được chuyển thể thành phim điện ảnh cùng tên.",
    "parts": [
      {
        "stt": "1",
        "tit": "Đứa bé vẫn sống",
        "url": ["", ""],
        "dur": "31:20",
        "img": "DflfcUOrUjw",
        "eTit": "The Boy Who Lived"
      },
      {
        "stt": "2",
        "tit": "Tấm kính biến mất",
        "url": ["", ""],
        "dur": "22:29",
        "img": "TUtzV2FV7B0",
        "eTit": "The Vanishing Glass"
      },
      {
        "stt": "3",
        "tit": "Những lá thư không xuất xứ",
        "url": ["", ""],
        "dur": "25:44",
        "img": "p2MOsRDf_co",
        "eTit": "The Letters from No One"
      },
      {
        "stt": "4",
        "tit": "Người giữ khóa",
        "url": ["", ""],
        "dur": "25:59",
        "img": "JVlCRgF6SFQ",
        "eTit": "The Keeper of the Keys"
      },
      {
        "stt": "5",
        "tit": "Hẻm xéo",
        "url": ["", ""],
        "dur": "50:05",
        "img": "9eXeZ7DYHgM",
        "eTit": "Diagon Alley"
      },
      {
        "stt": "6",
        "tit": "Hành trình từ sân ga 9¾",
        "url": ["", ""],
        "dur": "45:46",
        "img": "vnPv1gOI8vY",
        "eTit": "The Journey from Platform Nine and Three-quarters"
      },
      {
        "stt": "7",
        "tit": "Chiếc nón phân loại",
        "url": ["", ""],
        "dur": "30:09",
        "img": "RpE-8vNQIT4",
        "eTit": "The Sorting Hat"
      },
      {
        "stt": "8",
        "tit": "Bậc thầy độc dược",
        "url": ["", ""],
        "dur": "20:51",
        "img": "4xzBn-vTBGI",
        "eTit": "The Potions Master"
      },
      {
        "stt": "9",
        "tit": "Cuộc giao đấu nửa đêm",
        "url": ["", ""],
        "dur": "38:16",
        "img": "9SOcHWLbw1g",
        "eTit": "The Midnight Duel"
      },
      {
        "stt": "10",
        "tit": "Lễ hội ma Halloween",
        "url": ["", ""],
        "dur": "29:45",
        "img": "bkno83JkncE",
        "eTit": "Halloween"
      },
      {
        "stt": "11",
        "tit": "Quidditch",
        "url": ["", ""],
        "dur": "25:21",
        "img": "COnupo7FJYk",
        "eTit": "Quidditch"
      },
      {
        "stt": "12",
        "tit": "Tấm gương ảo ảnh",
        "url": ["", ""],
        "dur": "41:38",
        "img": "cfar2nofnj0",
        "eTit": "The Mirror of Erised"
      },
      {
        "stt": "13",
        "tit": "Nicolas Flamel",
        "url": ["", ""],
        "dur": "22:54",
        "img": "craPZuLnHr8",
        "eTit": "Nicolas Flamel"
      },
      {
        "stt": "14",
        "tit": "Trứng rồng đen",
        "url": ["", ""],
        "dur": "26:41",
        "img": "4GMqIsRmOiQ",
        "eTit": "Norbert The Norwegian Ridgeback"
      },
      {
        "stt": "15",
        "tit": "Khu rừng cấm",
        "url": ["", ""],
        "dur": "36:09",
        "img": "1r2wXPTrSiQ",
        "eTit": "The Forbidden Forest"
      },
      {
        "stt": "16",
        "tit": "Bẫy sập",
        "url": ["", ""],
        "dur": "43:04",
        "img": "Lt4CrPMyR4g",
        "eTit": "Through the Trapdoor"
      },
      {
        "stt": "17",
        "tit": "Người hai mặt",
        "url": [
          "",
          "https://archive.org/download/harry-potter-va-hon-da-phu-thuy-tap-1.sna/HarryPotterTap1HonDaPhuThuy17Het_2.mp3"
        ],
        "dur": "36:55",
        "img": "D-kePpm-lxw",
        "eTit": "The Man with Two Faces"
      }
    ]
  },
  {
    "title": "Quyển 2. Harry Potter và Phòng chứa bí mật",
    "eTitle": "Harry Potter and the Chamber of Secrets",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Phương Minh, Kim Kiều",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/6/62/Harry_Potter_và_Phòng_chứa_bí_mật.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-2-177607.html",
      "https://audioaz.com/en/audiobook/harry-potter-va-phong-chua-bi-mat-tap-2",
      "https://archive.org/details/harry-potter-va-phong-chua-bi-mat-tap-2.sna",
      "https://kenhsachnoi.com/nghe/tap-02-harry-potter-va-phong-chua-bi-mat#fwdrapPlayer0?catid=6&trackid=0",
      "https://archive.org/details/KenhSachNoi.Com-harry-potter-va-phong-chua-bi-mat",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhYzsPFrRZK7peorOcjMED33",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATBfGWcjSZM7cBQ1S0Bo7B9-",
      "https://www.youtube.com/@BookLand90/videos"
    ],
    "grp": ["HP.TAP2$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-2-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-phong-chua-bi-mat-tap-2.sna/HarryPotterTap2PhongChuaBiMat<*~~*>_2.mp3"
        },
        {
          "urlLine": 2,
          "nd": 2,
          "wcSrc": "https://archive.org/download/KenhSachNoi.Com-harry-potter-va-phong-chua-bi-mat/<*~~*>.E02.Harry-Potter-Va-Phong-Chua-Bi-Mat_J-K-Rowling_[KenhSachNoi.Com].mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLdh4dk0fbkhYzsPFrRZK7peorOcjMED33"
    },
    "year": 1998,
    "intro": "<b>Harry Potter và Phòng chứa Bí mật</b> (tiếng Anh: Harry Potter and the Chamber of Secrets) là quyển thứ hai trong loạt truyện Harry Potter của J. K. Rowling. Truyện được phát hành bằng tiếng Anh tại Anh, Hoa Kỳ và nhiều nước khác vào ngày 2 tháng 7 năm 1998. Đến tháng 12 năm 2006 riêng tại Mỹ đã có khoảng 14.9 triệu bản được tiêu thụ. Bản dịch tiếng Việt được nhà văn Lý Lan dịch và xuất bản bởi Nhà xuất bản Trẻ thành 8 tập, in thành sách tháng 2 năm 2001.",
    "parts": [
      {
        "stt": "1",
        "tit": "Sinh nhật buồn nhất",
        "url": ["", "", ""],
        "dur": "21:38",
        "img": "uCTSCEi9kBY",
        "eTit": "The Worst Birthday"
      },
      {
        "stt": "2",
        "tit": "Lời cảnh báo của Dobby",
        "url": ["", "", ""],
        "dur": "23:34",
        "img": "GAFQtww0vyM",
        "eTit": "Dobby's Warning"
      },
      {
        "stt": "3",
        "tit": "Trang trại Hang sóc (Burrow)",
        "url": ["", "", ""],
        "dur": "33:17",
        "img": "wFWdKw5n4lA",
        "eTit": "The Burrow"
      },
      {
        "stt": "4",
        "tit": "Phú quý và cơ hàn",
        "url": ["", "", ""],
        "dur": "44:28",
        "img": "3vy1NetZ4P4",
        "eTit": "At Flourish and Blotts"
      },
      {
        "stt": "5",
        "tit": "Cây liễu roi",
        "url": ["", "", ""],
        "dur": "40:43",
        "img": "VLqDwxb6KJ8",
        "eTit": "The Whomping Willow"
      },
      {
        "stt": "6",
        "tit": "Gilderoy Lockhart",
        "url": ["", "", ""],
        "dur": "34:43",
        "img": "nPZ8YpvHBk8",
        "eTit": "Gilderoy Lockhart"
      },
      {
        "stt": "7",
        "tit": "Máu bùn và những tiếng thì thầm",
        "url": ["", "", ""],
        "dur": "35:59",
        "img": "wU-HZxHAsrg",
        "eTit": "Mudbloods and Murmurs"
      },
      {
        "stt": "8",
        "tit": "Tiệc tử nhật",
        "url": ["", "", ""],
        "dur": "36:26",
        "img": "BKqBtRIAk7g",
        "eTit": "The Deathday Party"
      },
      {
        "stt": "9",
        "tit": "Thông điệp trên tường",
        "url": ["", "", ""],
        "dur": "42:02",
        "img": "FUuVcAgN6oM",
        "eTit": "The Writing on the Wall"
      },
      {
        "stt": "10",
        "tit": "Trái Bludger tai quái",
        "url": ["", "", ""],
        "dur": "40:18",
        "img": "nVgv6JQ6U4A",
        "eTit": "The Rogue Bludger"
      },
      {
        "stt": "11",
        "tit": "Câu lạc bộ đấu tay đôi",
        "url": ["", "", ""],
        "dur": "49:25",
        "img": "o1dKpgH9qek",
        "eTit": "The Dueling Club"
      },
      {
        "stt": "12",
        "tit": "Món thuốc đa dịch",
        "url": ["", "", ""],
        "dur": "46:56",
        "img": "x7fmenzA8O4",
        "eTit": "The Polyjuice Potion"
      },
      {
        "stt": "13",
        "tit": "Cuốn nhật ký cực kỳ bí mật",
        "url": ["", "", ""],
        "dur": "44:27",
        "img": "cRMUj-EqdPI",
        "eTit": "The Very Secret Diary"
      },
      {
        "stt": "14",
        "tit": "Cornelius Fudge",
        "url": ["", "", ""],
        "dur": "33:58",
        "img": "9GCNEealI1o",
        "eTit": "Cornelius Fudge"
      },
      {
        "stt": "15",
        "tit": "Aragog",
        "url": ["", "", ""],
        "dur": "41:33",
        "img": "-OhagyXvQbM",
        "eTit": "Aragog"
      },
      {
        "stt": "16",
        "tit": "Phòng chứa bí mật",
        "url": ["", "", ""],
        "dur": "49:10",
        "img": "Oh9I5N_m9pU",
        "eTit": "The Chamber of Secrets"
      },
      {
        "stt": "17",
        "tit": "Người kế vị Slytherin",
        "url": ["", "", ""],
        "dur": "49:49",
        "img": "dkkUNH-wuMs",
        "eTit": "The Heir of Slytherin"
      },
      {
        "stt": "18",
        "tit": "Phần thưởng cho Dobby",
        "url": [
          "",
          "https://archive.org/download/harry-potter-va-phong-chua-bi-mat-tap-2.sna/HarryPotterTap2PhongChuaBiMat18Het_2.mp3",
          ""
        ],
        "dur": "36:55",
        "img": "5to2wMHAL_Q",
        "eTit": "Dobby's Reward"
      }
    ]
  },
  {
    "title": "Quyển 3. Harry Potter và Tên tù nhân ngục Azkaban",
    "eTitle": "Harry Potter and the Prisoner of Azkaban",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Đồng Linh, Nam Dương",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/9/9f/Harry_Potter_v%C3%A0_t%C3%AAn_t%C3%B9_nh%C3%A2n_ng%E1%BB%A5c_Azkaban_b%C3%ACa.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-3-177619.html",
      "https://archive.org/details/harry-potter-tap-3-ten-tu-nhan-nguc-azkaban.sna",
      "https://archive.org/details/harry-potter-va-ten-tu-nhan-nguc-azkaban-tap-3.sna",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhbXkboByEUBuMtxp2STl0Z7",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATBX-IfgqVe-fTKkISFU54Mi",
      "https://www.youtube.com/@BookLand90/videos"
    ],
    "grp": ["HP.TAP3$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-3-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-tap-3-ten-tu-nhan-nguc-azkaban.sna/HarryPotter3_<*~~*>.mp3"
        },
        {
          "urlLine": 2,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-ten-tu-nhan-nguc-azkaban-tap-3.sna/HarryPotterTap3TenTuNhanNgucAzkaban<*~~*>_2.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLdh4dk0fbkhbXkboByEUBuMtxp2STl0Z7"
    },
    "year": 1999,
    "intro": "<b>Harry Potter và tên tù nhân ngục Azkaban</b> (tiếng Anh: Harry Potter and the Prisoner of Azkaban) là một quyển tiểu thuyết thuộc thể loại giả tưởng kỳ ảo được viết bởi văn sĩ người Anh J. K. Rowling, đây cũng là tập thứ 3 trong bộ truyện Harry Potter. Quyển sách theo chân Harry Potter, cậu phù thủy nhỏ, trong năm học thứ ba của mình tại Trường Phù thủy và Pháp sư Hogwarts. Cùng với hai người bạn thân là Ronald Weasley và Hermione Granger, Harry phát hiện ra Sirius Black, là một tù nhân trốn chạy từ ngục Azkaban, người được tin rằng là một trong những tay sai của chúa tể Voldemort.<br/>Quyển sách được xuất bản lần đầu tại Vương Quốc Anh vào ngày 8 Tháng Bảy năm 1999 bởi Nhà xuất bản Bloomsbury và tại Hoa Kỳ vào ngày 8 Tháng Chín năm 1999 bởi Nhà xuất bản Scholastic Inc.Rowling nói tập này bà viết dễ dàng hơn và viết rất nhanh, bà đã hoàn thành nó chỉ mất 1 năm kể từ khi bắt tay vào viết. Cuốn sách đã được bán ra 68,000 bản chỉ trong 3 ngày đầu phát hành ở Hoa Kỳ và kể từ đó đã bán được hơn 3 triệu bàn trên khắp cả nước. Quyển này đã thắng giải Whitbread Children's Book Award vào năm 1999, giải Bram Stoker Award, và giải Locus Award for Best Fantasy Novel vào năm 2000, cũng như vài giải thưởng khác nữa bào gồm của giải Hugo.",
    "parts": [
      {
        "stt": "1",
        "tit": "Hộp thư cú",
        "url": ["", "", ""],
        "dur": "31:05",
        "img": "YhCCbR4g5R4",
        "eTit": "Owl Post"
      },
      {
        "stt": "2",
        "tit": "Sai lầm lớn của cô Marge",
        "url": ["", "", ""],
        "dur": "30:59",
        "img": "8B0HQl59TiA",
        "eTit": "Aunt Marge's Big Mistake"
      },
      {
        "stt": "3",
        "tit": "Chuyến xe đò hiệp sĩ",
        "url": ["", "", ""],
        "dur": "34:00",
        "img": "DfI1TjAcD_c",
        "eTit": "The Knight Bus"
      },
      {
        "stt": "4",
        "tit": "Quán Cái Vạc Lủng",
        "url": ["", "", ""],
        "dur": "40:13",
        "img": "R1e7w_eLDb4",
        "eTit": "The Leaky Cauldron"
      },
      {
        "stt": "5",
        "tit": "Giám ngục Azkaban",
        "url": ["", "", ""],
        "dur": "49:07",
        "img": "71UjOoEXy9Y",
        "eTit": "The Dementor"
      },
      {
        "stt": "6",
        "tit": "Móng vuốt và lá trà",
        "url": ["", "", ""],
        "dur": "48:56",
        "img": "KopJsTeaDGs",
        "eTit": "Talons and Tea Leaves"
      },
      {
        "stt": "7",
        "tit": "Ông kẹ trong tủ áo",
        "url": ["", "", ""],
        "dur": "30:38",
        "img": "aHDCVHysC2I",
        "eTit": "The Boggart in the Wardrobe"
      },
      {
        "stt": "8",
        "tit": "Chuyến bay của bà béo",
        "url": ["", "", ""],
        "dur": "40:46",
        "img": "yznXzFCGQo0",
        "eTit": "Flight of the Fat Lady"
      },
      {
        "stt": "9",
        "tit": "Chiến bại ác liệt",
        "url": ["", "", ""],
        "dur": "38:24",
        "img": "zWlma38w6Bc",
        "eTit": "Grim Defeat"
      },
      {
        "stt": "10",
        "tit": "Bản đồ của đạo tặc",
        "url": ["", "", ""],
        "dur": "52:03",
        "img": "8vDYaOyvVJI",
        "eTit": "The Marauder's Map"
      },
      {
        "stt": "11",
        "tit": "Tia chớp",
        "url": ["", "", ""],
        "dur": "45:37",
        "img": "nQbyBX9js-M",
        "eTit": "The Firebolt"
      },
      {
        "stt": "12",
        "tit": "Thần hộ mệnh",
        "url": ["", "", ""],
        "dur": "36:44",
        "img": "AITkR_VNtiQ",
        "eTit": "The Patronus"
      },
      {
        "stt": "13",
        "tit": "Gryffindor đấu với Ravenclaw",
        "url": ["", "", ""],
        "dur": "30:33",
        "img": "sR1ItOrgwdk",
        "eTit": "Gryffindor Versus Ravenclaw"
      },
      {
        "stt": "14",
        "tit": "Mối ác cảm của thầy Snape",
        "url": ["", "", ""],
        "dur": "39:31",
        "img": "UYMl0eY_v94",
        "eTit": "Snape's Grudge"
      },
      {
        "stt": "15",
        "tit": "Chung kết Quidditch",
        "url": ["", "", ""],
        "dur": "47:59",
        "img": "3mjWPxgD2N8",
        "eTit": "The Quidditch Final"
      },
      {
        "stt": "16",
        "tit": "Tiên đoán của giáo sư Trelawney",
        "url": ["", "", ""],
        "dur": "36:07",
        "img": "MpvlJznna8A",
        "eTit": "Professor Trelawney's Prediction"
      },
      {
        "stt": "17",
        "tit": "Mèo, Chuột và Chó",
        "url": ["", "", ""],
        "dur": "31:06",
        "img": "8hQAuItW8gA",
        "eTit": "Cat, Rat, and Dog"
      },
      {
        "stt": "18",
        "tit": "Mơ mộng ngớ ngẩn, Đuôi trùn, Chân nhồi bông và Gạc nai",
        "url": ["", "", ""],
        "dur": "16:15",
        "img": "3FgPlpcxmSY",
        "eTit": "Moony, Wormtail, Padfoot, and Prongs"
      },
      {
        "stt": "19",
        "tit": "Đầy tớ của chúa tể Voldermort",
        "url": ["", "", ""],
        "dur": "41:40",
        "img": "VK3vMsMlBaA",
        "eTit": "The Servant of Lord Voldemort"
      },
      {
        "stt": "20",
        "tit": "Cái hôn của giám ngục",
        "url": ["", "", ""],
        "dur": "17:09",
        "img": "0OcmL4mpK5k",
        "eTit": "The Dementor's Kiss"
      },
      {
        "stt": "21",
        "tit": "Bí mật của Hermione",
        "url": ["", "", ""],
        "dur": "58:42",
        "img": "tfZG0dDIsas",
        "eTit": "Hermione's Secret"
      },
      {
        "stt": "22",
        "tit": "Lại hộp thư cú",
        "url": [
          "",
          "",
          "https://archive.org/download/harry-potter-va-ten-tu-nhan-nguc-azkaban-tap-3.sna/HarryPotterTap3TenTuNhanNgucAzkaban22Het_2.mp3"
        ],
        "dur": "38:08",
        "img": "iGn5OeGiYig",
        "eTit": "Owl Post Again"
      }
    ]
  },
  {
    "title": "Quyển 4. Harry Potter và Chiếc cốc lửa",
    "eTitle": "Harry Potter and the Goblet of Fire",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Nam Dương, Đồng Linh, Phương Minh, Ngọc Minh",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/thumb/8/88/Harry_Potter_và_Chiếc_cốc_lửa_bìa.jpg/250px-Harry_Potter_và_Chiếc_cốc_lửa_bìa.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-4-177624.html",
      "https://audioaz.com/en/audiobook/harry-potter-va-chiec-coc-lua-tap-4",
      "https://archive.org/details/harry-potter-va-chiec-coc-lua-tap-4.sna",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhbf7ncOwQc2MDSbWXVCevKe",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATBWrh2SG08vUwp9zmkVXGBk",
      "https://www.youtube.com/@BookLand90/videos"
    ],
    "grp": ["HP.TAP4$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-4-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-chiec-coc-lua-tap-4.sna/HarryPotterTap4ChiecCocLua<*~~*>_2.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLdh4dk0fbkhbf7ncOwQc2MDSbWXVCevKe"
    },
    "year": 2000,
    "intro": "<b>Harry Potter và chiếc cốc lửa</b> (tiếng Anh: Harry Potter and the Goblet of Fire) là một quyển sách thuộc thể loại giả tưởng kỳ ảo được viết bởi tác giả người Anh J. K. Rowling và đây cũng là phần thứ tư trong bộ tiểu thuyết Harry Potter. Câu chuyện kể về cậu bé Harry Potter, một phù thủy trong năm học thứ tư của mình tại Trường Phù thủy và Pháp sư Hogwarts cùng vời những bí ẩn xung quanh việc thêm tên của Harry vào giải đấu Tam Pháp Thuật, buộc cậu phải nỗ lực hết mình để chiến đấu.<br/>Cuốn sách được xuất bản ở Anh bởi Nhà xuất bản Bloomsbury và ở Hoa Kỳ bởi Nhà xuất bản Scholastic; việc phát hành sách ở cả hai quốc gia cùng vào ngày 8 tháng 7 năm 2000, và đây cũng là lần đầu tiên một quyển trong bộ truyện này được xuất bản ở hai quốc gia cùng một lúc. Cuốn tiểu thuyết này đã đoạt giải Hugo Award, quyển duy nhất trong bộ Harry Potter đạt được giải này vào năm 2001. Quyển sách cũng được chuyển thể thành phim điện ảnh, và được phát hành trên toàn thế giới vào ngày 18 tháng 11 năm 2005, cùng với một trò chơi điện tử của Electronic Arts.",
    "parts": [
      {
        "stt": "1",
        "tit": "Ngôi nhà Riddle",
        "url": ["", ""],
        "dur": "34:14",
        "img": "qyd6C-WokCg",
        "eTit": "The Riddle House"
      },
      {
        "stt": "2",
        "tit": "Vết thẹo",
        "url": ["", ""],
        "dur": "20:48",
        "img": "Y4gD-pCjC3k",
        "eTit": "The scar"
      },
      {
        "stt": "3",
        "tit": "Thiệp mời",
        "url": ["", ""],
        "dur": "24:05",
        "img": "DmEIOUpIFOc",
        "eTit": "The invitation"
      },
      {
        "stt": "4",
        "tit": "Trở lại trang trại Hang Sóc",
        "url": ["", ""],
        "dur": "22:59",
        "img": "luJ74wW-MZg",
        "eTit": "Back to the burrow"
      },
      {
        "stt": "5",
        "tit": "Mánh phù thủy nhà Weasley",
        "url": ["", ""],
        "dur": "29:57",
        "img": "DI5ooh_CWYQ",
        "eTit": "Weasley's wizard wheezes"
      },
      {
        "stt": "6",
        "tit": "Khóa cảng",
        "url": ["", ""],
        "dur": "19:10",
        "img": "0iKBUqO-57A",
        "eTit": "The portkey"
      },
      {
        "stt": "7",
        "tit": "Bagman và Crouch",
        "url": ["", ""],
        "dur": "42:32",
        "img": "3AfMjEImdNo",
        "eTit": "Bagman and Crouch"
      },
      {
        "stt": "8",
        "tit": "Cúp Quidditch thế giới",
        "url": ["", ""],
        "dur": "43:17",
        "img": "801skUrt_jU",
        "eTit": "The Quidditch World Cup"
      },
      {
        "stt": "9",
        "tit": "Dấu hiệu đen",
        "url": ["", ""],
        "dur": "1:01:12",
        "img": "c1YD7EUKuTA",
        "eTit": "The dark mark"
      },
      {
        "stt": "10",
        "tit": "Hỗn loạn ở Bộ Pháp Thuật",
        "url": ["", ""],
        "dur": "26:22",
        "img": "wIlKo1J3wkI",
        "eTit": "Mayhem at the Ministry"
      },
      {
        "stt": "11",
        "tit": "Trên tàu tốc hành Hogwarts",
        "url": ["", ""],
        "dur": "27:10",
        "img": "JYKED4jWMLs",
        "eTit": "Aboard the Hogwarts Express"
      },
      {
        "stt": "12",
        "tit": "Thi đấu Tam Pháp Thuật",
        "url": ["", ""],
        "dur": "44:13",
        "img": "6zUHnuu4UGs",
        "eTit": "The Triwizard Tournament"
      },
      {
        "stt": "13",
        "tit": "Moody Mắt Điên",
        "url": ["", ""],
        "dur": "26:21",
        "img": "-vWc_fiHpao",
        "eTit": "Mad-Eye Moody"
      },
      {
        "stt": "14",
        "tit": "Những lời nguyền không thể tha thứ",
        "url": ["", ""],
        "dur": "37:34",
        "img": "HcemjL72g-Q",
        "eTit": "The unforgivable curses"
      },
      {
        "stt": "15",
        "tit": "Trường Beauxbatons và trường Dumstrang",
        "url": ["", ""],
        "dur": "36:18",
        "img": "SgJOZc3Cj0M",
        "eTit": "Beauxbatons and durmstrang"
      },
      {
        "stt": "16",
        "tit": "Chiếc cốc lửa",
        "url": ["", ""],
        "dur": "45:32",
        "img": "NM73KJGVqts",
        "eTit": "The goblet of fire"
      },
      {
        "stt": "17",
        "tit": "Vị quán quân thứ tư",
        "url": ["", ""],
        "dur": "31:34",
        "img": "cP87x3yZQ9w",
        "eTit": "The four champions"
      },
      {
        "stt": "18",
        "tit": "Cân đũa phép",
        "url": ["", ""],
        "dur": "48:00",
        "img": "Gl2ofO-Thus",
        "eTit": "The weighing of the wands"
      },
      {
        "stt": "19",
        "tit": "Rồng Đuôi Gai Hungary",
        "url": ["", ""],
        "dur": "44:27",
        "img": "vVREqDtpHWw",
        "eTit": "The Hungarian horntail"
      },
      {
        "stt": "20",
        "tit": "Bài thi đầu tiên",
        "url": ["", ""],
        "dur": "50:56",
        "img": "p8fewKacRB8",
        "eTit": "The first task"
      },
      {
        "stt": "21",
        "tit": "Mặt trận giải phóng gia tinh",
        "url": ["", ""],
        "dur": "45:45",
        "img": "Bw7SBEEC8gQ",
        "eTit": "The House-Elf Liberation Front"
      },
      {
        "stt": "22",
        "tit": "Công tác bất ngờ",
        "url": ["", ""],
        "dur": "36:53",
        "img": "pyguTXTl2i8",
        "eTit": "The unexpected task"
      },
      {
        "stt": "23",
        "tit": "Dạ vũ giáng sinh",
        "url": ["", ""],
        "dur": "59:39",
        "img": "G2THuqVxtCY",
        "eTit": "The Yule Ball"
      },
      {
        "stt": "24",
        "tit": "Tin Giật Gân Của Rita Skeeter",
        "url": ["", ""],
        "dur": "52:56",
        "img": "w9sOB9-A_WI",
        "eTit": "Rita Skeeter's scoop"
      },
      {
        "stt": "25",
        "tit": "Cái trứng và con mắt",
        "url": ["", ""],
        "dur": "45:35",
        "img": "ozcBG3OGuRQ",
        "eTit": "The egg and the eye"
      },
      {
        "stt": "26",
        "tit": "Bài Thi Thứ Hai",
        "url": ["", ""],
        "dur": "55:51",
        "img": "cukGdEQvEZQ",
        "eTit": "The second task"
      },
      {
        "stt": "27",
        "tit": "Chân Nhồi Bông Trở Lại",
        "url": ["", ""],
        "dur": "55:44",
        "img": "CpjRo3Haj0w",
        "eTit": "Padfoot returns"
      },
      {
        "stt": "28",
        "tit": "Cơn Điên Của Ông Crouch",
        "url": ["", ""],
        "dur": "55:04",
        "img": "ON0C8XdwrQY",
        "eTit": "The madness of Mr. Crouch"
      },
      {
        "stt": "29",
        "tit": "Giấc Mơ",
        "url": ["", ""],
        "dur": "38:25",
        "img": "0298te9QgAc",
        "eTit": "The dream"
      },
      {
        "stt": "30",
        "tit": "Cái Tưởng Ký",
        "url": ["", ""],
        "dur": "57:17",
        "img": "JmTQs4eEVKY",
        "eTit": "The pensieve"
      },
      {
        "stt": "31",
        "tit": "Bài Thi Thứ Ba",
        "url": ["", ""],
        "dur": "1:07:22",
        "img": "pSBaTxpyg7Q",
        "eTit": "The third task"
      },
      {
        "stt": "32",
        "tit": "Máu, Thịt, Và Xương",
        "url": ["", ""],
        "dur": "13:23",
        "img": "I4j60r9kqYE",
        "eTit": "Flesh, blood, and bone"
      },
      {
        "stt": "33",
        "tit": "Tử Thần Thực Tử",
        "url": ["", ""],
        "dur": "29:37",
        "img": "abC8FrHy9aA",
        "eTit": "The death eaters"
      },
      {
        "stt": "34",
        "tit": "Những Câu Thần Chú Từ Trước Tới Nay",
        "url": ["", ""],
        "dur": "23:20",
        "img": "Gy15uQPVLKI",
        "eTit": "Priori incantatem"
      },
      {
        "stt": "35",
        "tit": "Chân Dược",
        "url": ["", ""],
        "dur": "53:14",
        "img": "lH9bpJ2bJac",
        "eTit": "Veritaserum"
      },
      {
        "stt": "36",
        "tit": "Ngã Ba Đường",
        "url": ["", ""],
        "dur": "47:52",
        "img": "-lYcwIxThQE",
        "eTit": "The parting of the ways"
      },
      {
        "stt": "37",
        "tit": "Bắt Đầu",
        "url": [
          "",
          "https://archive.org/download/harry-potter-va-chiec-coc-lua-tap-4.sna/HarryPotterTap4ChiecCocLua37Het_2.mp3"
        ],
        "dur": "33:59",
        "img": "cYWkY1Kh4_E",
        "eTit": "The beginning"
      }
    ]
  },
  {
    "title": "Quyển 5. Harry potter và Hội phượng hoàng",
    "eTitle": "Harry Potter and the Order of Phoenix",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Nam Dương, Đồng Linh, Ngọc Minh",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/thumb/7/74/Harry_Potter_và_Hội_phượng_hoàng.jpg/250px-Harry_Potter_và_Hội_phượng_hoàng.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-5-177632.html",
      "https://audioaz.com/en/audiobook/harry-potter-va-hoi-phuong-hoang-tap-5",
      "https://archive.org/details/harry-potter-va-hoi-phuong-hoang-tap-5.sna",
      "https://thcsquangan.thuvien.edu.vn/harry-potter-va-hoi-phuong-hoang-t5-phan-1/audio392540",
      "https://thcsquangan.thuvien.edu.vn/harry-potter-va-hoi-phuong-hoang-t5-phan-2/audio392713",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhZhqttn2GlCiaVi-FX4Z4J5",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATCBhYmVCkQ-FVj8H7rtMXaI",
      "https://www.youtube.com/@BookLand90/videos"
    ],
    "grp": ["HP.TAP5$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-5-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-hoi-phuong-hoang-tap-5.sna/HarryPotterVaHoiPhuongHoang<*~~*>_2.mp3"
        },
		{
          "urlLine": 2,
          "nd": -1,
          "wcSrc": "https://medialib.qlgd.edu.vn/Uploads/THU_VIEN/shn/2/929/UserSounds/Harry-Potter-5---Hoi-Phuong-Hoang-<*~~*>"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLdh4dk0fbkhZhqttn2GlCiaVi-FX4Z4J5"
    },
    "year": 2003,
    "intro": "<b>Harry Potter và hội Phượng hoàng</b> (tiếng Anh: Harry Potter and the Order of the Phoenix) là quyển thứ 5 trong bộ sách Harry Potter của nhà văn J. K. Rowling. Quyển này được đồng loạt xuất bản vào ngày 21 tháng 6 năm 2003 tại Anh, Hoa Kỳ, Canada, Úc và một vài quốc gia khác. Trong ngày đầu tiên xuất bản, nó đã bán được gần 7 triệu cuốn riêng tại Hoa Kỳ và Anh. Nguyên bản tiếng Anh dài 38 chương và gồm khoảng 255.000 chữ.<br/>Bản dịch chính thức đầu tiên là tiếng Việt, được Nhà xuất bản Trẻ xuất bản từ bản dịch của nhà văn Lý Lan từ ngày 21 tháng 7 đến 15 tháng 12 năm 2003. Bản dịch được chia ra 22 tập, và được in thành sách vào tháng 9 năm 2004. Một số tập ban đầu dùng tựa <b>Harry Potter và mệnh lệnh phượng hoàng.</b><br/>Bộ phim phỏng theo quyển này được sản xuất bởi hãng Warner Bros và được trình chiếu từ ngày 13 tháng 7 năm 2007.",
	"parts": [
	  {
		"stt": "1",
		"tit": "Dudley bị ếm",
		"url": ["", "", "1-b9ac3e76-db8f-463e-b0c4-680a7c568150.mp3"],
		"dur": "47:34",
		"img": "fwfnoyJOSBQ",
		"eTit": "Dudley demented"
	  },
	  {
		"stt": "2",
		"tit": "Một bầy cú",
		"url": ["", "", "2-2ed94538-2300-48bf-8ab8-180d85f74695.mp3"],
		"dur": "56:40",
		"img": "Oot8H2GjcuI",
		"eTit": "A peck of owls"
	  },
	  {
		"stt": "3",
		"tit": "Đoàn vệ sĩ tiên phong",
		"url": ["", "", "3-f47a82d1-169c-4683-bd58-34d1f20443b6.mp3"],
		"dur": "39:41",
		"img": "vLjPjWnBkKg",
		"eTit": "The advance guard"
	  },
	  {
		"stt": "4",
		"tit": "Số 12, Quảng trường Grimmauld",
		"url": ["", "", "4-30634a52-bd66-4db2-9e6f-679da8c79e8b.mp3"],
		"dur": "43:45",
		"img": "krf3rIT95g8",
		"eTit": "Number twelve, Grimmauld Place"
	  },
	  {
		"stt": "5",
		"tit": "Hội Phượng Hoàng",
		"url": ["", "", "5-d2c26e36-39cd-4ad9-924d-29d1d0a67014.mp3"],
		"dur": "49:00",
		"img": "jtxodt0Tj5o",
		"eTit": "The Order of the Phoenix"
	  },
	  {
		"stt": "6",
		"tit": "Dòng họ cao quí và lâu đời nhất",
		"url": ["", "", "6-0c3fb545-6f38-4058-b5bd-a5725b7b32b5.mp3"],
		"dur": "50:27",
		"img": "UBeX7Dx_d6Y",
		"eTit": "The noble and most ancient House of Black"
	  },
	  {
		"stt": "7",
		"tit": "Bộ pháp thuật",
		"url": ["", "", "7-b128e85a-8f26-4dd7-82f0-bbb17f57e483.mp3"],
		"dur": "37:23",
		"img": "4eI30_IER_A",
		"eTit": "The Ministry of Magic"
	  },
	  {
		"stt": "8",
		"tit": "Phiên tòa",
		"url": ["", "", "8-9e4be1e6-c7b6-44be-b996-efabf8a486b8.mp3"],
		"dur": "35:41",
		"img": "OD2bEotRVc8",
		"eTit": "The hearing"
	  },
	  {
		"stt": "9",
		"tit": "Nỗi thống khổ của bà Weasley",
		"url": ["", "", "9-aa6f0c83-8ae3-49da-948c-2a44b7819b44.mp3"],
		"dur": "1:08:02",
		"img": "3TX6rWWq-sM",
		"eTit": "The woes of Mrs. Weasley"
	  },
	  {
		"stt": "10",
		"tit": "Luna Lovegood",
		"url": ["", "", "10-4d21a48a-4998-4f1c-8078-631cbebb185f.mp3"],
		"dur": "47:09",
		"img": "Gnm-GTLoJEI",
		"eTit": "Luna Lovegood"
	  },
	  {
		"stt": "11",
		"tit": "Bài ca mới của cái nón phân loại",
		"url": ["", "", "11-e9cfb42e-6771-4cf8-b3f5-d922c3c55a06.mp3"],
		"dur": "47:27",
		"img": "riNPj_7Shp8",
		"eTit": "The Sorting Hat's new song"
	  },
	  {
		"stt": "12",
		"tit": "Giáo sư Umbridge",
		"url": ["", "", "12-ab17a2a2-34f7-45e4-99b6-b384f5160c8d.mp3"],
		"dur": "59:52",
		"img": "wj4zs0gvEys",
		"eTit": "Professor Umbridge"
	  },
	  {
		"stt": "13",
		"tit": "Cấm túc với Dolores",
		"url": ["", "", "13-226de6bd-611a-4db7-b0a2-b0c3f6e52591.mp3"],
		"dur": "1:09:27",
		"img": "FNg3n6IbcVc",
		"eTit": "Detention with Dolores"
	  },
	  {
		"stt": "14",
		"tit": "Percy và chân nhồi bông",
		"url": ["", "", "14-3fec7645-b3fe-4eaf-b217-7a6ac10bc5ad.mp3"],
		"dur": "55:54",
		"img": "BJV4u-RDyhg",
		"eTit": "Percy and Padfoot"
	  },
	  {
		"stt": "15",
		"tit": "Thanh tra tối cao trường Hogwarts",
		"url": ["", "", "15-56fa3650-9144-4f61-9d20-828b442c612e.mp3"],
		"dur": "51:33",
		"img": "SH5UTMvMDrI",
		"eTit": "The Hogwarts High Inquisitor"
	  },
	  {
		"stt": "16",
		"tit": "Trong quán đầu heo",
		"url": ["", "", "16-8692295d-cef9-43b4-a5ec-70a15059766c.mp3"],
		"dur": "53:47",
		"img": "ewZ5nCX8lwI",
		"eTit": "In the Hog's Head"
	  },
	  {
		"stt": "17",
		"tit": "Đạo luật giáo dục số 24",
		"url": ["", "", "17-716a430b-8608-4eb2-b6ac-bd78155c33ed.mp3"],
		"dur": "58:19",
		"img": "Gd0AwQMg8rA",
		"eTit": "Educational Decree Number Twenty-Four"
	  },
	  {
		"stt": "18",
		"tit": "Đoàn quân Dumbledore",
		"url": ["", "", "18-82fdd824-378b-41f5-a784-13a3c6ee6e8f.mp3"],
		"dur": "1:01:35",
		"img": "mcvJuzB1h88",
		"eTit": "Dumbledore's army"
	  },
	  {
		"stt": "19",
		"tit": "Sư tử và rắn",
		"url": ["", "", "19-7b30e0e3-5c63-44da-84f5-ac407fd26354.mp3"],
		"dur": "49:36",
		"img": "0o_EM5aJu68",
		"eTit": "The lion and the serpent"
	  },
	  {
		"stt": "20",
		"tit": "Chuyện của bác Hagrid",
		"url": ["", "", "20-819f2993-41d0-4e8a-8678-743b46c303fc.mp3"],
		"dur": "45:14",
		"img": "jvzjN_QBZj4",
		"eTit": "Hagrid's tale"
	  },
	  {
		"stt": "21",
		"tit": "Mắt rắn",
		"url": ["", "", "21-0fc90935-7d5d-47dc-a92e-d9eac46d2868.mp3"],
		"dur": "54:27",
		"img": "Me0UF4Bqv-4",
		"eTit": "The eye of the snake"
	  },
	  {
		"stt": "22",
		"tit": "Bệnh viện thánh Mungo chuyên trị thương tích và bệnh tật pháp thuật",
		"url": ["", "", "22-6897c862-9f66-4271-96d7-3dfd3c404f72.mp3"],
		"dur": "1:09:03",
		"img": "ZjCWSrYxA1Q",
		"eTit": "St. Mungo's Hospital for Magical Maladies and Injuries"
	  },
	  {
		"stt": "23",
		"tit": "Giáng sinh trong phòng kín",
		"url": ["", "", "23-e577b96e-1439-43a3-8069-052800b1e362.mp3"],
		"dur": "59:28",
		"img": "JCZQqsvjMno",
		"eTit": "Christmas on the closed ward"
	  },
	  {
		"stt": "24",
		"tit": "Bế quan bí thuật",
		"url": ["", "", "24-907dad64-f095-4cea-89bb-599e6c5502ee.mp3"],
		"dur": "1:16:25",
		"img": "h1lLnC2vHcU",
		"eTit": "Occlumency"
	  },
	  {
		"stt": "25",
		"tit": "Con bọ kẹt cánh",
		"url": ["", "", "25-c250d518-68a5-4329-b88b-93a682e95351.mp3"],
		"dur": "1:14:48",
		"img": "j493Qy5EPTY",
		"eTit": "The beetle at bay"
	  },
	  {
		"stt": "26",
		"tit": "Biết và không biết trước",
		"url": ["", "", "26-f45acefd-ab16-42df-86b3-3ecf67e68d74.mp3"],
		"dur": "1:16:27",
		"img": "7jZZ2r5li6Y",
		"eTit": "Seen and unforeseen"
	  },
	  {
		"stt": "27",
		"tit": "Nhân mã và chỉ điểm",
		"url": ["", "", "27-e4f8a1f5-6de3-4684-96cb-c50e92603033.mp3"],
		"dur": "1:11:44",
		"img": "LEIjE3hGwtg",
		"eTit": "The centaur and the sneak"
	  },
	  {
		"stt": "28",
		"tit": "Ký ức tệ nhất của thầy Snape",
		"url": ["", "", "28-7b1e98e6-7a93-4341-9829-0113cbe22a72.mp3"],
		"dur": "1:13:09",
		"img": "PPP8d1ljeMU",
		"eTit": "Snape's worst memory"
	  },
	  {
		"stt": "29",
		"tit": "Cố vấn nghề nghiệp",
		"url": ["", "", "29-bd0c173e-20d8-41cf-8a3e-f4c5cd338e13.mp3"],
		"dur": "1:03:46",
		"img": "z4G86thBDzI",
		"eTit": "Career advice"
	  },
	  {
		"stt": "30",
		"tit": "Grawp",
		"url": ["", "", "30-71aafc1d-f07a-431f-8ea3-d6b3e4e04ccd.mp3"],
		"dur": "1:09:42",
		"img": "mdO1js6dY2Y",
		"eTit": "Grawp"
	  },
	  {
		"stt": "31",
		"tit": "Pháp sư thường đẳng",
		"url": ["", "", "31-9d9451ec-95eb-4d62-a139-185210901a4c.mp3"],
		"dur": "1:00:43",
		"img": "lQGoKAGUhbI",
		"eTit": "O.W.L.s"
	  },
	  {
		"stt": "32",
		"tit": "Thoát lửa",
		"url": ["", "", "32-e658a4d6-c077-424d-9d09-e1078e5ed875.mp3"],
		"dur": "47:58",
		"img": "LkS0FhrQYHQ",
		"eTit": "Out of the fire"
	  },
	  {
		"stt": "33",
		"tit": "Chiến đấu và đào tẩu",
		"url": ["", "", "33-0f14a0f0-a569-4641-836b-c01a647c4319.mp3"],
		"dur": "34:09",
		"img": "PdJlxXFbMN4",
		"eTit": "Fight and flight"
	  },
	  {
		"stt": "34",
		"tit": "Sở bảo mật",
		"url": ["", "", "34-c2533b35-878e-461b-800c-6676db645065.mp3"],
		"dur": "43:31",
		"img": "JQRztUSOQq4",
		"eTit": "The Department of Mysteries"
	  },
	  {
		"stt": "35",
		"tit": "Bên kia bức màn",
		"url": ["", "", "35-61fecef3-54d5-4e9e-a212-1618645c84fd.mp3"],
		"dur": "58:10",
		"img": "DVDJWFd2thc",
		"eTit": "Beyond the veil"
	  },
	  {
		"stt": "36",
		"tit": "Người duy nhất hắn sợ",
		"url": ["", "", "36-6fa2f704-9bb4-4847-a283-c766a2beedca.mp3"],
		"dur": "29:46",
		"img": "x9ML3xsyCWg",
		"eTit": "The only one he ever feared"
	  },
	  {
		"stt": "37",
		"tit": "Lời tiên tri đã mất",
		"url": ["", "", "37-84887781-2a40-40d9-b084-b483ef9e10d3.mp3"],
		"dur": "1:17:34",
		"img": "wjOAXKbdZSI",
		"eTit": "The lost prophecy"
	  },
	  {
		"stt": "38",
		"tit": "Cuộc chiến thứ hai bắt đầu",
		"url": [
		  "",
		  "https://archive.org/download/harry-potter-va-hoi-phuong-hoang-tap-5.sna/HarryPotterVaHoiPhuongHoang38Het_2.mp3",
		  "38End-1d5fc317-76fd-4ce8-81a8-2bc69b3db39b.mp3"
		],
		"dur": "1:07:01",
		"img": "eMvI71eAqiQ",
		"eTit": "The second war begins"
	  }
	]},
  {
    "title": "Quyển 6. Harry Potter và Hoàng tử lai",
    "eTitle": "Harry Potter and the Half-Blood Prince",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Phương Minh",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/a/a5/HBP.JPG",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-6-177642.html",
      "https://thcsquangan.thuvien.edu.vn/harry-potter-va-hoang-tu-lai-t6/audio392780",
      "https://archive.org/details/harry-potter-va-hoang-tu-lai-tap-6-.sna",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATBWx1XptEeIpwmwoDs4k_67",
      "https://www.youtube.com/playlist?list=PLdh4dk0fbkhbfQN4PXhAuXTDS1B0G-6pk"
    ],
    "grp": ["HP.TAP6$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-6-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 2,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-hoang-tu-lai-tap-6-.sna/HarryPotteTap6_<*~~*>_2.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://medialib.qlgd.edu.vn/Uploads/THU_VIEN/shn/2/929/UserSounds/Harry-Potter-6---Hoang-tu-lai-<*~~*>"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLPUW-yTH_ATBWx1XptEeIpwmwoDs4k_67"
    },
    "year": 2005,
    "intro": "<b>Harry Potter và Hoàng tử lai</b> (tiếng Anh: Harry Potter and the Half-Blood Prince) là quyển sách thứ sáu trong bộ sách giả tưởng nổi tiếng Harry Potter của tác giả J.K. Rowling. Cũng như các quyển trước, nó cũng trở thành một trong những best-seller (sách bán chạy nhất) của năm nó xuất bản. Quyển sách này được tung ra bản tiếng Anh cùng lúc trên toàn thế giới vào ngày 16 tháng 7 năm 2005, đặc biệt là ở Anh, Mỹ, Canada và Úc. Chỉ trong 24 giờ đầu tiên, nó đã bán được hơn 6,9 triệu quyển khắp nước Mỹ.<br/>Cuộc phiêu lưu mới này gồm một loạt các khám phá về quá khứ của Chúa tể Voldemort, kèm theo những miêu tả sinh động về tuổi mới lớn với những xúc cảm ngây thơ, vui nhộn và nỗi căm hận đắng cay của Harry đối với \"Hoàng tử Lai\".<br/>Tại Việt Nam, quyển truyện Harry Potter này được Nhà xuất bản Trẻ xuất bản theo bản dịch của dịch giả Lý Lan vào ngày 24 tháng 9 năm 2005. Cũng như quyển năm, bản dịch này được in trọn bộ thay vì chia ra thành nhiều tập như bản dịch các quyển 1-4.",
	"parts": [
	  {
		"stt": "1",
		"tit": "Một vị Bộ trưởng của Thế giới khác",
		"url": ["", "1-c26991ce-4077-4ee7-86bc-d7149dae311e.mp3", ""],
		"dur": "40:46",
		"img": "MZv7Eahl1h8",
		"eTit": "The other minister"
	  },
	  {
		"stt": "2",
		"tit": "Đường bàn xoay",
		"url": ["", "2-75c25acd-e47b-40e7-be04-0b356e256fb3.mp3", ""],
		"dur": "42:32",
		"img": "N4cg7vjSELw",
		"eTit": "Spinner's End"
	  },
	  {
		"stt": "3",
		"tit": "Sẽ và sẽ không",
		"url": ["", "3-f8c8b02b-242b-4f20-aa44-5b9ff13352b9.mp3", ""],
		"dur": "38:53",
		"img": "QfcX8XdBJJE",
		"eTit": "Will and won't"
	  },
	  {
		"stt": "4",
		"tit": "Horace Slughorn",
		"url": ["", "4-2b8e12b6-6eeb-482f-8e0c-2bacbfb9493f.mp3", ""],
		"dur": "49:38",
		"img": "qTTwHH55Bms",
		"eTit": "Horace Slughorn"
	  },
	  {
		"stt": "5",
		"tit": "Hơi bị nhớt",
		"url": ["", "5-41ed6ea0-0c08-44fd-b064-97b3a7537d14.mp3", ""],
		"dur": "45:36",
		"img": "ppJKwsBdc60",
		"eTit": "An excess of phlegm"
	  },
	  {
		"stt": "6",
		"tit": "Khúc ngoặt của Draco",
		"url": ["", "6-4ef04bfb-1805-4102-9ad6-f3d87fba2052.mp3", ""],
		"dur": "46:18",
		"img": "K6T5hPRL0rI",
		"eTit": "Draco's detour"
	  },
	  {
		"stt": "7",
		"tit": "Câu lạc bộ Slug",
		"url": ["", "7-68ddbfa5-0618-4581-849e-62aa39e0e62a.mp3", ""],
		"dur": "50:59",
		"img": "28nI6S-ghCk",
		"eTit": "The Slug Club"
	  },
	  {
		"stt": "8",
		"tit": "Thầy Snape đắc thắng",
		"url": ["", "8-613754a0-e3af-4520-8c1d-d74db0d36217.mp3", ""],
		"dur": "32:19",
		"img": "uTYcJMr9Yl4",
		"eTit": "Snape victorious"
	  },
	  {
		"stt": "9",
		"tit": "Hoàng tử lai",
		"url": ["", "9-ee01ec94-91fd-40f7-817d-980f007cfe3f.mp3", ""],
		"dur": "47:08",
		"img": "xfe33nsYYm8",
		"eTit": "The Half-Blood Prince"
	  },
	  {
		"stt": "10",
		"tit": "Ngôi nhà của bá tước",
		"url": ["", "10-6d4d75b8-620f-49b9-a27f-150fd69362e8.mp3", ""],
		"dur": "47:23",
		"img": "v0KQHnLSMuY",
		"eTit": "The house of Gaunt"
	  },
	  {
		"stt": "11",
		"tit": "Trợ thủ Hermione",
		"url": ["", "11-526c3715-e1b8-43a7-8e67-833a8f6c8913.mp3", ""],
		"dur": "39:29",
		"img": "apeazojHIMU",
		"eTit": "Hermione's helping hand"
	  },
	  {
		"stt": "12",
		"tit": "Bạc & Ngọc mắt mèo",
		"url": ["", "12-d0407cdc-e18b-4cfb-8cb8-6503cb0d06bf.mp3", ""],
		"dur": "38:25",
		"img": "M16QGp6wOZY",
		"eTit": "Silver and opals"
	  },
	  {
		"stt": "13",
		"tit": "Riddle bí ẩn",
		"url": ["", "13-981b3b84-a214-4e6c-8fab-454e7176dd6c.mp3", ""],
		"dur": "42:18",
		"img": "beZUWUp4JsE",
		"eTit": "The secret Riddle"
	  },
	  {
		"stt": "14",
		"tit": "Phúc lạc dược",
		"url": ["", "14-e7d3cdac-04f8-4c41-ab95-f237fa716313.mp3", ""],
		"dur": "48:01",
		"img": "EEOAiY3GUO4",
		"eTit": "Felix Felicis"
	  },
	  {
		"stt": "15",
		"tit": "Phép thề bất khả bội",
		"url": ["", "15-4c74ad11-fa34-4f8b-8037-3874c89ef858.mp3", ""],
		"dur": "42:08",
		"img": "vY1af7LiuFo",
		"eTit": "The Unbreakable Vow"
	  },
	  {
		"stt": "16",
		"tit": "Một mùa giáng sinh giá buốt",
		"url": ["", "16-d84090c9-0e41-4d9d-84a2-f7472e1f0711.mp3", ""],
		"dur": "45:39",
		"img": "-cBnk4zSpVQ",
		"eTit": "A very frosty Christmas"
	  },
	  {
		"stt": "17",
		"tit": "Một ký ức bị nhiễu",
		"url": ["", "17-0674b9b0-70b4-4002-82eb-b8a0c99eb76a.mp3", ""],
		"dur": "49:19",
		"img": "f1kEDYEdkFA",
		"eTit": "A Sluggish memory"
	  },
	  {
		"stt": "18",
		"tit": "Những bất ngờ sinh nhật",
		"url": ["", "18-fde78727-8416-4415-9d75-1c9c9d7729c5.mp3", ""],
		"dur": "47:02",
		"img": "6Akzcf39y-4",
		"eTit": "Birthday surprises"
	  },
	  {
		"stt": "19",
		"tit": "Gia tinh bám đuôi",
		"url": ["", "19-f5909251-b61c-490b-8dc4-35e969126c39.mp3", ""],
		"dur": "44:10",
		"img": "ALAn1kREdDI",
		"eTit": "Elf tails"
	  },
	  {
		"stt": "20",
		"tit": "Thỉnh cầu của Chúa tể Voldemort",
		"url": ["", "20-182aba67-df01-4a23-adcf-0a4a74c27951.mp3", ""],
		"dur": "50:35",
		"img": "54-1V4j_q7I",
		"eTit": "Lord Voldemort's request"
	  },
	  {
		"stt": "21",
		"tit": "Phòng bất khả tri",
		"url": ["", "21-7aed2544-cfa5-4e40-bda4-87830885f742.mp3", ""],
		"dur": "41:12",
		"img": "yOIdmlVvnYs",
		"eTit": "The Unknowable Room"
	  },
	  {
		"stt": "22",
		"tit": "Sau tang lễ",
		"url": ["", "22-8ac92594-4eba-4fb3-8ba2-534ddf183c25.mp3", ""],
		"dur": "44:44",
		"img": "zaNdKtVO74k",
		"eTit": "After the burial"
	  },
	  {
		"stt": "23",
		"tit": "Những trường sinh linh giá",
		"url": ["", "23-c839b264-096d-4c0b-8936-c5217b7924df.mp3", ""],
		"dur": "44:50",
		"img": "WOR3kR2jTxU",
		"eTit": "Horcruxes"
	  },
	  {
		"stt": "24",
		"tit": "Cắt sâu mãi mãi",
		"url": ["", "24-e7a196f7-618a-4489-ac72-94d4baf503cb.mp3", ""],
		"dur": "41:16",
		"img": "PjGDh1Pyw-4",
		"eTit": "Sectumsempra"
	  },
	  {
		"stt": "25",
		"tit": "Nhà tiên tri bị nghe trộm",
		"url": ["", "25-d7a66851-4611-4790-82dd-f455304d56ba.mp3", ""],
		"dur": "35:57",
		"img": "kIhQh-Wq5Zc",
		"eTit": "The seer overheard"
	  },
	  {
		"stt": "26",
		"tit": "Hang động",
		"url": ["", "26-48fed397-fcfd-4609-9c91-2044dba424cc.mp3", ""],
		"dur": "46:22",
		"img": "",
		"eTit": "The cave"
	  },
	  {
		"stt": "27",
		"tit": "Tháp sét đánh",
		"url": ["", "27-0b3b06b2-a073-4957-9652-4338cb8c49ea.mp3", ""],
		"dur": "33:34",
		"img": "xT7pkvD3PeQ",
		"eTit": "The lightning-struck tower"
	  },
	  {
		"stt": "28",
		"tit": "Cuộc đào tẩu của Hoàng tử",
		"url": ["", "28-11002af6-4186-4341-bc3c-60a917f3285e.mp3", ""],
		"dur": "26:02",
		"img": "U7zFpy1triQ",
		"eTit": "Flight of the Prince"
	  },
	  {
		"stt": "29",
		"tit": "Phượng hoàng than khóc",
		"url": [
		  "",
		  "29-ea777311-4c69-4413-a433-34364517afc3.mp3",
		  "https://archive.org/download/harry-potter-va-hoang-tu-lai-tap-6-.sna/HarryPotteTap6_29_HET_2.mp3"
		],
		"dur": "39:48",
		"img": "",
		"eTit": "The Phoenix lament"
	  },
	  {
		"stt": "30",
		"tit": "Ngôi mộ trắng",
		"url": ["", "30-End-e4399735-7712-44f7-9927-49cde84bd36f.mp3", null],
		"dur": "38:15",
		"img": "",
		"eTit": "The white tomb."
	  }
	]},
  {
    "title": "Quyển 7. Harry Potter và Bảo bối Tử thần",
    "eTitle": "Harry Potter and the Deathly Hallows",
    "author": "J. K. Rowling",
    "type": "Truyện Giả Tưởng",
    "mc": "Nam Dương, Đồng Linh, Ngọc Minh",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/4/4d/HARRY-7.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/harry-potter-7-177647.html",
      "https://thcsquangan.thuvien.edu.vn/harry-potter-va-bao-boi-tu-than/audio392859",
      "https://audioaz.com/en/audiobook/harry-potter-va-bao-boi-tu-than-tap-7",
      "https://archive.org/details/harry-potter-va-bao-boi-tu-than-tap-7.sna",
      "https://www.youtube.com/playlist?list=PLPUW-yTH_ATDRuaGxZxT4_aIuSoZVwDMo&pp=iAQB"
    ],
    "grp": ["HP.TAP7$4", "HP.DLND", "HP.DLND"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Harry-Potter-Tap-7-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/harry-potter-va-bao-boi-tu-than-tap-7.sna/HARRY POTTER TAP 7 BAO BOI TU THAN <*~~*>.mp3"
        },
        {
          "urlLine": 2,
          "nd": -1,
          "wcSrc": "https://medialib.qlgd.edu.vn/Uploads/THU_VIEN/shn/2/929/UserSounds/Harry-Potter-va-B£o-bNi-ti-th§n-T-p-7---J.K.-Rowling-<*~~*>"
        }
      ]
    },
	"tap" : [
		{"label": "Phần I", "f": 1, "t": 25},
		{"label": "Phần II", "f": 26, "t": 37}
	],
    "year": 2007,
    "intro": "<b>Harry Potter và Bảo bối Tử thần</b> (nguyên tác tiếng Anh: Harry Potter and the Deathly Hallows) là cuốn sách thứ bảy và cũng là cuối cùng của bộ tiểu thuyết giả tưởng Harry Potter của nhà văn Anh J.K. Rowling.<br/>Nguyên bản tiếng Anh được phát hành đồng thời tại Anh, Hoa Kỳ, Canada và một số nước khác (trong đó có Việt Nam) vào ngày 21 tháng 7 năm 2007. Bản dịch tiếng Việt vẫn do nhà văn Lý Lan đảm nhiệm, xuất bản ngày 27 tháng 10 cùng năm",
	"parts": [
	  {
		"stt": "1",
		"tit": "Chúa tể hắc ám đang lên",
		"url": ["", "", "dc2ea017-0bb0-4ccd-b875-b08c43fd8a5b.mp3"],
		"dur": "22:35",
		"img": "",
		"eTit": "The Dark Lord ascending"
	  },
	  {
		"stt": "2",
		"tit": "Hoài niệm",
		"url": ["", "", "2-a55b5e47-33bf-4891-b503-e13cd438dee3.mp3"],
		"dur": "28:22",
		"img": "",
		"eTit": "In memoriam"
	  },
	  {
		"stt": "3",
		"tit": "Cuộc ra đi của nhà Dursleys",
		"url": ["", "", "3-11cf143d-dbbe-4547-982b-5630b68fce8a.mp3"],
		"dur": "23:57",
		"img": "",
		"eTit": "The Dursleys departing"
	  },
	  {
		"stt": "4",
		"tit": "Bẫy Potter",
		"url": ["", "", "4-e3fa249c-a900-44ed-8237-acda66fa0000.mp3"],
		"dur": "43:58",
		"img": "",
		"eTit": "The seven Potters"
	  },
	  {
		"stt": "5",
		"tit": "Chiến binh rơi rụng",
		"url": ["", "", "5-3a5c170a-942e-4128-9c8d-eb99ce19dd9e.mp3"],
		"dur": "52:55",
		"img": "",
		"eTit": "Fallen warrior"
	  },
	  {
		"stt": "6",
		"tit": "Con ma xó mặt đồ ngủ",
		"url": ["", "", "6-7ff4e62b-4d82-4607-a9f3-65060a4104a0.mp3"],
		"dur": "54:31",
		"img": "",
		"eTit": "The ghoul in pajamas"
	  },
	  {
		"stt": "7",
		"tit": "Di chúc của cụ Albus Dumbledore",
		"url": ["", "", "7-8110f9fb-9676-4673-b312-10ac0c784c98.mp3"],
		"dur": "56:10",
		"img": "",
		"eTit": "The will of Albus Dumbledore"
	  },
	  {
		"stt": "8",
		"tit": "Đám cưới",
		"url": ["", "", "8-c8c9c812-843f-4da0-b371-0c015d74dd62.mp3"],
		"dur": "44:51",
		"img": "",
		"eTit": "The wedding"
	  },
	  {
		"stt": "9",
		"tit": "Một nơi để trốn",
		"url": ["", "", "9-9af862b7-d251-4576-a260-42d535e79fcb.mp3"],
		"dur": "29:18",
		"img": "",
		"eTit": "A place to hide"
	  },
	  {
		"stt": "10",
		"tit": "Câu chuyện của Kreacher",
		"url": ["", "", "10-e2b59a85-ee40-4313-81e3-43c1cb350c15.mp3"],
		"dur": "46:57",
		"img": "",
		"eTit": "Kreacher's tale"
	  },
	  {
		"stt": "11",
		"tit": "Quà hối lộ",
		"url": ["", "", "11-a41aa03c-1068-423c-bf13-78924871d3f8.mp3"],
		"dur": "43:26",
		"img": "",
		"eTit": "The bribe"
	  },
	  {
		"stt": "12",
		"tit": "Pháp thuật là quyền lực",
		"url": ["", "", "12-7a2f4e83-509e-4951-90fa-d1daffa9ea27.mp3"],
		"dur": "45:53",
		"img": "",
		"eTit": "Magic is might"
	  },
	  {
		"stt": "13",
		"tit": "Ủy ban đăng ký phù thủy gốc Muggle",
		"url": ["", "", "13-e5c5f540-2c98-486b-9ccd-aea79bc0fa26.mp3"],
		"dur": "40:24",
		"img": "",
		"eTit": "The Muggle-born Registration Commission"
	  },
	  {
		"stt": "14",
		"tit": "Tên trộm",
		"url": ["", "", "14-444916f9-48fe-4216-9e10-25102e031a12.mp3"],
		"dur": "28:55",
		"img": "",
		"eTit": "The thief"
	  },
	  {
		"stt": "15",
		"tit": "Yêu tinh rửa hận",
		"url": ["", "", "15-4130d10f-059a-444f-ad35-fffc1e406748.mp3"],
		"dur": "49:27",
		"img": "",
		"eTit": "The goblin's revenge"
	  },
	  {
		"stt": "16",
		"tit": "Thung lũng Godric",
		"url": ["", "", "16-2615d64a-d83d-4fa4-a764-6bfb11db0d08.mp3"],
		"dur": "42:53",
		"img": "",
		"eTit": "Godric's Hollow"
	  },
	  {
		"stt": "7",
		"tit": "Bí mật Bathilda",
		"url": ["", "", "17-fd65636c-dd09-41da-b8eb-8ea05ff6bfba.mp3"],
		"dur": "48:21",
		"img": "",
		"eTit": "Bathilda's secret"
	  },
	  {
		"stt": "18",
		"tit": "Chuyện đời và chuyện xạo của Albus Dumbledore",
		"url": ["", "", "18-f15891f7-30a3-4a78-bd08-5feaa3fa4b37.mp3"],
		"dur": "27:49",
		"img": "",
		"eTit": "The life and lies of Albus Dumbledore"
	  },
	  {
		"stt": "19",
		"tit": "Con hươu bạc",
		"url": ["", "", "19-b37da0d8-82a4-481b-b600-13218c364872.mp3"],
		"dur": "56:25",
		"img": "",
		"eTit": "The silver doe"
	  },
	  {
		"stt": "20",
		"tit": "Ông Lexophilus Lovegood",
		"url": ["", "", "20-281b9dc9-68e3-4ef6-8267-7942c684b327.mp3"],
		"dur": "30:15",
		"img": "",
		"eTit": "Xenophilius Lovegood"
	  },
	  {
		"stt": "21",
		"tit": "Chuyện kể về ba anh em",
		"url": ["", "", "21-62a04ea8-0e52-4f6f-9dd9-fd367748b63c.mp3"],
		"dur": "33:59",
		"img": "",
		"eTit": "The tale of the three brothers"
	  },
	  {
		"stt": "22",
		"tit": "Những bảo bối tử thần",
		"url": ["", "", "22-9fec9848-28c4-4f4e-b56e-034962a19db3.mp3"],
		"dur": "48:42",
		"img": "",
		"eTit": "The Deathly Hallows"
	  },
	  {
		"stt": "23",
		"tit": "Phủ Malfoy",
		"url": ["", "", "23-475e16d6-bedf-42d4-8ecb-a341b8e13938.mp3"],
		"dur": "1:08:09",
		"img": "",
		"eTit": "Malfoy Manor"
	  },
	  {
		"stt": "24",
		"tit": "Người chế tạo đũa phép",
		"url": ["", "", "24-cc4c9de1-82d6-487a-95de-4c8e2a09bb6e.mp3"],
		"dur": "56:44",
		"img": "",
		"eTit": "The wandmaker"
	  },
	  {
		"stt": "25",
		"tit": "Chòi đất",
		"url": ["", "", "25-f14b336c-daac-4ae5-9321-6d2431d2921d.mp3"],
		"dur": "32:54",
		"img": "",
		"eTit": "Shell Cottage"
	  },
	  {
		"stt": "26",
		"tit": "Gringotts",
		"url": ["", "", "26-f987b2b0-e88a-4fe7-95d8-7390557fa463.mp3"],
		"dur": "49:50",
		"img": "",
		"eTit": "Gringotts"
	  },
	  {
		"stt": "27",
		"tit": "Chổ giấu cuối cùng",
		"url": ["", "", "27-dd720b61-b88d-4d22-b30e-c53707d779cc.mp3"],
		"dur": "22:05",
		"img": "",
		"eTit": "The final hiding place"
	  },
	  {
		"stt": "28",
		"tit": "Mảnh gương thất lạc",
		"url": ["", "", "28-fc7dc30e-1c5e-4ffb-89fe-314fd09846dd.mp3"],
		"dur": "40:03",
		"img": "",
		"eTit": "The missing mirror"
	  },
	  {
		"stt": "29",
		"tit": "Vòng nguyệt quế bị mất",
		"url": ["", "", "29-0822beaf-8f18-4cbc-88c7-ce14fa67b877.mp3"],
		"dur": "35:57",
		"img": "",
		"eTit": "The lost diadem"
	  },
	  {
		"stt": "30",
		"tit": "Tống cổ Severus Snape",
		"url": ["", "", "30-5529225d-2565-4d44-b0bb-cb63e4ac6401.mp3"],
		"dur": "41:28",
		"img": "",
		"eTit": "The sacking of Severus Snape"
	  },
	  {
		"stt": "31",
		"tit": "Chiến trường Hogwarts",
		"url": ["", "", "31-e684d969-a21c-43e1-872e-a75964d686ec.mp3"],
		"dur": "1:08:50",
		"img": "",
		"eTit": "The battle of Hogwarts"
	  },
	  {
		"stt": "32",
		"tit": "Cây đũa phép cơm nguội",
		"url": ["", "", "32-bd688be0-f83d-45e2-b286-c00cbeb39a68.mp3"],
		"dur": "40:15",
		"img": "",
		"eTit": "The elder wand"
	  },
	  {
		"stt": "33",
		"tit": "Chuyện của Prince",
		"url": ["", "", "33-0860a793-c45c-4879-a81e-2c4e5c7185e2.mp3"],
		"dur": "1:11:32",
		"img": "",
		"eTit": "The prince's tale"
	  },
	  {
		"stt": "34",
		"tit": "Trở lại rừng cấm",
		"url": ["", "", "34-30bc1cd8-80c5-4d56-88ca-c06e363e58dd.mp3"],
		"dur": "26:56",
		"img": "",
		"eTit": "The forest again"
	  },
	  {
		"stt": "35",
		"tit": "Ngã tư vua",
		"url": ["", "", "35-2786c2f7-32ae-4d59-bf14-7315653db9db.mp3"],
		"dur": "37:23",
		"img": "",
		"eTit": "King's Cross"
	  },
	  {
		"stt": "36",
		"tit": "Sơ hở trong kế hoạch",
		"url": ["", "", "36---End-fa64e148-8e02-4473-ae03-0904d1070aab.mp3"],
		"dur": "1:04:52",
		"img": "",
		"eTit": "The flaw in the plan"
	  },
	  {
		"stt": "37",
		"tit": "19 năm sau",
		"url": ["", "", null],
		"dur": "11:34",
		"img": "",
		"eTit": "Epilogue"
	  }
	]}
		]};

const tdkData = {
"meta" : {
	"name" : "Tây Du Ký",
	"eName" : "Journey to the East",
	"bookGrp" : [
		[ {"label": "Tây Du Ký", "gId": "$5"} ],
		[ {"label": "Tây Du Ký", "gId": "TDK.TDK"} ],
		[ {"label": "Tây Du Ký", "gId": "TDK.TDK"} ]
	]
},
"books": [
  {
    "title": "Tây Du Ký",
    "eTitle": "Journey to the West",
    "author": "Ngô Thừa Ân",
    "type": "Tiểu thuyết thần ma",
    "mc": "Mạnh Linh, Hướng Dương",
    "cover": "https://kenhsachnoi.com/wp-content/uploads/2022/04/MP3-Sach-Noi-FULL-Tay-Du-Ky-tac-gia-Ngo-Thua-An-KenhSachNoi.Com_.jpg",
    "ssrc": [
      "https://phatphapungdung.com/sach-noi/tay-du-ky-ngo-thua-an-178123.html",
      "https://audioaz.com/en/audiobook/tay-du-ky",
      "https://archive.org/details/tay-du-ky.sna/",
      "https://nghetruyen.org/chi-tiet/tay-du-ky-1753.html",
      "https://archive.org/download/tayduky_201903",
      "https://archive.org/details/TayDuKyHoi10",
      "https://www.youtube.com/playlist?list=PLoSTejtguGRM502M2fH2qxWYDfFPt8c0Q"
    ],
    "grp": ["TDK.TDK$5", "TDK.TDK", "TDK.TDK"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/sach-noi-new/tieu-thuyet-van-hoc-nuoc-ngoai-phat-phap-ung-dung/Tay-Du-Ky-2-<*~~*>-phatphapungdung.com.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/tay-du-ky.sna/TayDuKi<*~~*>_2.mp3"
        },
        {
          "urlLine": 2,
          "nd": 1,
          "wcSrc": "https://archive.org/download/tayduky_201903/<*~~*>.mp3"
        },
        {
          "urlLine": 3,
          "nd": 1,
          "wcSrc": "https://archive.org/download/TayDuKyHoi10/Tây Du Ký - Hồi <*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLoSTejtguGRM502M2fH2qxWYDfFPt8c0Q"
    },
	"tap" : [
		{"label": "Chương 1 đến chương 10", "f": 1, "t": 10},
		{"label": "Chương 11 đến chương 20", "f": 11, "t": 20},
		{"label": "Chương 21 đến chương 30", "f": 21, "t": 30},
		{"label": "Chương 31 đến chương 40", "f": 31, "t": 40},
		{"label": "Chương 41 đến chương 50", "f": 41, "t": 50},
		{"label": "Chương 51 đến chương 60", "f": 51, "t": 60},
		{"label": "Chương 61 đến chương 70", "f": 61, "t": 70},
		{"label": "Chương 71 đến chương 80", "f": 71, "t": 80},
		{"label": "Chương 81 đến chương 90", "f": 81, "t": 90},
		{"label": "Chương 91 đến chương 100", "f": 91, "t": 100}
	],
    "year": "1590",
    "intro": "<b>Tây Du Ký</b> (phồn thể: 西遊記; giản thể: 西游记; bính âm: Xī Yóu Jì; Wade-Giles: Hsi Yu Chi), là một trong những tác phẩm kinh điển trong văn học Trung Hoa. Được xuất bản với tác giả giấu tên trong những năm 1590 và không có bằng chứng trực tiếp còn tồn tại để biết tác giả của nó, nhưng tác phẩm này thường được cho là của tác giả Ngô Thừa Ân. Tiểu thuyết thuật lại chuyến đi đến Ấn Độ của nhà sư Huyền Trang (Đường Tam Tạng) đi lấy kinh.<br/>Trong tiểu thuyết, Trần Huyền Trang (陳玄奘) được Quan Âm Bồ Tát bảo đến Tây Trúc (Ấn Độ) thỉnh kinh Phật giáo mang về Trung Quốc. Theo ông là 4 đệ tử - một khỉ đá tên Tôn Ngộ Không (孫悟空), một yêu quái nửa người nửa lợn tên Trư Ngộ Năng (豬悟能) và một thủy quái tên Sa Ngộ Tĩnh (沙悟淨) - họ đều đồng ý theo ông đi thỉnh kinh để chuộc tội. Con ngựa Huyền Trang cưỡi cũng là một hoàng tử của Long Vương (Bạch Long Mã).<br/>Đường đi gặp biết bao gian nan trắc trở, bao hiểm nguy mà thầy trò Đường Tam Tạng phải đối đầu, trong đó nhiều yêu quái là đồ đệ của các vị Tiên, Phật. Một số yêu tinh muốn ăn thịt Huyền Trang, một số khác muốn cám dỗ họ bằng cách biến thành những mỹ nhân. Tôn Ngộ Không phải sử dụng phép thuật và quan hệ của mình với thế giới yêu quái và Tiên, Phật để đánh bại các kẻ thù nhiều mánh khóe, như Ngưu Ma Vương hay Thiết Phiến Công chúa,...<br/>Cuối cùng, sau 81 kiếp nạn, bốn thầy trò cũng đến được xứ sở của Phật tổ, mang kinh Phật truyền bá về phương Đông.",
    "parts": [
      {
        "stt": 1,
        "tit": "Gốc thiêng ấp ủ nguồn rộng chảy - Tâm tính sửa sang đạo lớn sinh.",
        "url": ["", "", "", ""],
        "dur": "38:43",
        "img": "F7vSAArIO_c",
        "oUrl": "YY3Zhc2_1Xg"
      },
      {
        "stt": 2,
        "tit": "Thấu lẽ Bồ Đề là diệu lý - Bỏ ma về gốc ấy nguyên thần.",
        "url": ["", "", "", ""],
        "dur": "35:54",
        "img": "IjVauOuJdqE",
        "oUrl": "htOUjtIsl5E"
      },
      {
        "stt": 3,
        "tit": "Bốn biển nghìn non đều sợ phục - Mười loại âm ti thảy xóa tên.",
        "url": ["", "", "", ""],
        "dur": "44:42",
        "img": "6asqax8PArw",
        "oUrl": "EMOMhe4T9ic"
      },
      {
        "stt": 4,
        "tit": "Quan phong Bật Mã lòng đâu thỏa - Tên gọi Tề Thiên dạ chẳng yên.",
        "url": ["", "", "", ""],
        "dur": "45:13",
        "img": "LRvAuUAxmOE",
        "oUrl": "BsDsKZ9rhDc"
      },
      {
        "stt": 5,
        "tit": "Loạn vườn đào Đại Thánh trộm thuốc tiên - Về thiên cung các thần bắt yêu quái.",
        "url": ["", "", "", ""],
        "dur": "43:18",
        "img": "W8LN2y9lcuk",
        "oUrl": "345JCKJ3C9Q"
      },
      {
        "stt": 6,
        "tit": "Quan Âm dự hội hỏi nguyên nhân - Tiểu Thánh trổ tài bắt Đại Thánh.",
        "url": ["", "", "", ""],
        "dur": "30:51",
        "img": "l7MBDDGZr9I",
        "oUrl": "7t-PKjVOoQA"
      },
      {
        "stt": 7,
        "tit": "Đại Thánh trốn khỏi lò bát quái - Hầu vương giam dưới núi Ngũ hành.",
        "url": ["", "", "", ""],
        "dur": "28:26",
        "img": "qdk0wyDk8mc",
        "oUrl": "fmjczGhoUR0"
      },
      {
        "stt": 8,
        "tit": "Phật Tổ tạo kinh truyền cực lạc - Quan Âm vâng mệnh đến Tràng An.",
        "url": ["", "", "", ""],
        "dur": "52:31",
        "img": "dZId6AFk77Q",
        "oUrl": "FYJ0bBxAybQ"
      },
      {
        "stt": 9,
        "tit": "Trần Quang Nhị nhậm chức gặp nạn - Sư Giang Lưu phục thù báo ơn.",
        "url": ["", "", "", ""],
        "dur": "52:16",
        "img": "xvW0mi61crs",
        "oUrl": "klYAowgCmaI"
      },
      {
        "stt": 10,
        "tit": "Lão Long vương vụng kế phạm phép trời - Ngụy Thừa tướng gửi thư nhờ âm sứ.",
        "url": ["", "", "", ""],
        "dur": "1:06:24",
        "img": "0DavzESpg4A",
        "oUrl": "gJG0-NRTN5U"
      },
      {
        "stt": 11,
        "tit": "Chơi âm phủ Thái Tông về trần - Dâng quả bí Lưu Toàn gặp vợ.",
        "url": ["", "", "", ""],
        "dur": "34:59",
        "img": "n1XAMFp7UOE",
        "oUrl": "FvQRdSq2X1k"
      },
      {
        "stt": 12,
        "tit": "Vua Đường lòng thành mở đại hội - Quan Âm hiển thánh hóa Kim Thiền.",
        "url": ["", "", "", ""],
        "dur": "49:48",
        "img": "T0gK67UuKZM",
        "oUrl": "vJMg2ueYZb8"
      },
      {
        "stt": 13,
        "tit": "Sa hang cọp Kim Tinh cứu thoát - Núi Song Xoa Bá Khâm mời sư.",
        "url": ["", "", "", ""],
        "dur": "42:04",
        "img": "shUW-2O0HdM",
        "oUrl": "PQEs4D8tx84"
      },
      {
        "stt": 14,
        "tit": "Lòng vượn theo đường chính - Sáu giặc mất tăm hơi.",
        "url": ["", "", "", ""],
        "dur": "58:22",
        "img": "3d9QCFZORn4",
        "oUrl": "tqBe4NS9AE8"
      },
      {
        "stt": 15,
        "tit": "Núi Xà Bàn các thần ngầm giúp - Khe Ưng Sầu long mã thắng cương.",
        "url": ["", "", "", ""],
        "dur": "47:23",
        "img": "xcqypylXzCo",
        "oUrl": "A0FJaO2uWqE"
      },
      {
        "stt": 16,
        "tit": "Viện Quan Âm, các sư lừa bảo bối - Núi Hắc Phong, yêu quái lấy trộm cà sa.",
        "url": ["", "", "", ""],
        "dur": "35:03",
        "img": "T9L9apfkOmo",
        "oUrl": "j1jOxlJL1Yk"
      },
      {
        "stt": 17,
        "tit": "Tôn Hành Giả đại náo núi Hắc Phong - Quan Thế Âm thu phục yêu tinh gấu.",
        "url": ["", "", "", ""],
        "dur": "39:00",
        "img": "hxZqOatDCfw",
        "oUrl": "gE_qAJmPMbc"
      },
      {
        "stt": 18,
        "tit": "Chùa Quan Âm, Đường Tăng thoát nạn - Thôn Cao Lão, Đại Thánh trừ ma.",
        "url": ["", "", "", ""],
        "dur": "33:39",
        "img": "fc3J9KFvmtg",
        "oUrl": "TGqtXippCzg"
      },
      {
        "stt": 19,
        "tit": "Động Vân Sạn, Ngộ Không thu Bát Giới - Núi Phù Đồ, Tam Tạng nhận Tâm kinh.",
        "url": ["", "", "", ""],
        "dur": "49:00",
        "img": "ZyWoEHnx6C0",
        "oUrl": "tKPfTt751Qs"
      },
      {
        "stt": 20,
        "tit": "Núi Hoàng Phong, Đường Tăng gặp nạn - Giữa rừng thẳm, Bát Giới lập công",
        "url": ["", "", "", ""],
        "dur": "41:32",
        "img": "VSPDkK21xeM",
        "oUrl": "nyhRCe1OrR8"
      },
      {
        "stt": 21,
        "tit": "Hộ pháp dựng nhà lưu Đại Thánh - Tu Di Linh Cát bắt yêu ma.",
        "url": ["", "", "", ""],
        "dur": "29:53",
        "img": "sScVe7Loo3Y",
        "oUrl": "Zw3QPhJ69yg"
      },
      {
        "stt": 22,
        "tit": "Bát Giới đại chiến sông Lưu Sa - Mộc Soa vâng lệnh bắt Ngộ Tĩnh.",
        "url": ["", "", "", ""],
        "dur": "31:54",
        "img": "UhA7b4MFkdw",
        "oUrl": "FCVhDnsmuwk"
      },
      {
        "stt": 23,
        "tit": "Tam Tạng không quên gốc - Bốn Thánh thử lòng thiền.",
        "url": ["", "", "", ""],
        "dur": "34:52",
        "img": "S84Yy_t9VlY",
        "oUrl": "pp_YjnI6laU"
      },
      {
        "stt": 24,
        "tit": "Núi Vạn Thọ, Đại tiên lưu bạn cũ - Quán Ngũ Trang, Hành Giả trộm nhân sâm.",
        "url": ["", "", "", ""],
        "dur": "34:32",
        "img": "n_p7T-EDKXI",
        "oUrl": "LhAvc_O0f1A"
      },
      {
        "stt": 25,
        "tit": "Trấn Nguyên đại tiên đuổi bắt người lấy kinh - Tôn Hành Giả đại náo Ngũ Trang quán.",
        "url": ["", "", "", ""],
        "dur": "32:24",
        "img": "vC6w9kPdnzw",
        "oUrl": "2y4dtlT9qM4"
      },
      {
        "stt": 26,
        "tit": "Khắp ba đảo, Ngộ Không tìm thuốc - Nước Cam Lộ, Bồ Tát chữa cây.",
        "url": ["", "", "", ""],
        "dur": "49:35",
        "img": "vUSdaN8a630",
        "oUrl": "Rj13tCtiROo"
      },
      {
        "stt": 27,
        "tit": "Thây ma ba lượt trêu Tam Tạng - Đường Tăng giận đuổi Mỹ Hầu Vương.",
        "url": ["", "", "", ""],
        "dur": "31:21",
        "img": "a0sDgAe3nCk",
        "oUrl": "i7Wj_1az6oY"
      },
      {
        "stt": 28,
        "tit": "Núi Hoa Quả lũ yêu tụ nghĩa - Rừng Hắc Tùng Tam Tạng gặp ma.",
        "url": ["", "", "", ""],
        "dur": "28:45",
        "img": "4S8AfqOVOeY",
        "oUrl": "5dTGlREFzVs"
      },
      {
        "stt": 29,
        "tit": "Thoát nạn Giáng Lưu sang nước khác - Đội ơn Bát Giới chuyển non ngàn.",
        "url": ["", "", "", ""],
        "dur": "42:21",
        "img": "zdZn0g1YUqE",
        "oUrl": "doAwXKFbRk4"
      },
      {
        "stt": 30,
        "tit": "Tà ma phạm chính đạo - Tiểu Long nhớ Ngộ Không.",
        "url": ["", "", "", ""],
        "dur": "49:24",
        "img": "LiiG0b5mDnE",
        "oUrl": "Ly7QedBD_1A"
      },
      {
        "stt": 31,
        "tit": "Trư Bát Giới lấy nghĩa khích Hầu Vương - Tôn Ngộ Không dùng mưu hàng yêu quái.",
        "url": ["", "", "", ""],
        "dur": "38:00",
        "img": "rpyz6G0BwtA",
        "oUrl": "N8cJvAe8xtY"
      },
      {
        "stt": 32,
        "tit": "Núi Bình Đính, Công tào truyền tín - Động Liên Hoa, Bát Giới gặp tai.",
        "url": ["", "", "", ""],
        "dur": "35:10",
        "img": "OQ556_z_q84",
        "oUrl": "H_nhfD5jbbk"
      },
      {
        "stt": 33,
        "tit": "Ngoại đạo mê chân tính - Nguyên thần giúp bản tâm.",
        "url": ["", "", "", ""],
        "dur": "52:59",
        "img": "pRjLYXH_YCA",
        "oUrl": "qc-9rkfSqL0"
      },
      {
        "stt": 34,
        "tit": "Ma vương giỏi mẹo khốn Hầu Vương - Đại Thánh khéo lừa thay bảo bối.",
        "url": ["", "", "", ""],
        "dur": "55:00",
        "img": "ReZ2T81jA4g",
        "oUrl": "rEFkKKdH9gY"
      },
      {
        "stt": 35,
        "tit": "Ngoại đạo ra oai lừa tính thẳng - Ngộ Không được báu thắng yêu ma.",
        "url": ["", "", "", ""],
        "dur": "44:36",
        "img": "o_1NJtBUVYY",
        "oUrl": "GL5FKj6ugpw"
      },
      {
        "stt": 36,
        "tit": "Ngộ Không xử đúng muôn duyên phục - Đạo tà phá bỏ thấy trăng soi.",
        "url": ["", "", "", ""],
        "dur": "51:15",
        "img": "1u2WaQ0n4Cw",
        "oUrl": "WRzKEESxLZc"
      },
      {
        "stt": 37,
        "tit": "Đêm khuya vua quỷ cầu Tam Tạng - Hóa phép Ngộ Không dắt trẻ thơ.",
        "url": ["", "", "", ""],
        "dur": "37:50",
        "img": "jSkXB7IJigA",
        "oUrl": "XJtM0RZnPJM"
      },
      {
        "stt": 38,
        "tit": "Trẻ thơ hỏi mẹ tà hay chính - Kim Mộc thăm dò rõ thực hư.",
        "url": ["", "", "", ""],
        "dur": "35:05",
        "img": "v9ALk8CzzCU",
        "oUrl": "6-BTGBaa_E4"
      },
      {
        "stt": 39,
        "tit": "Một hạt linh đơn xin thượng giới - Ba năm vua cũ lại hồi sinh.",
        "url": ["", "", "", ""],
        "dur": "36:06",
        "img": "hv10Gdybkuw",
        "oUrl": "a0Z4lbr3o1I"
      },
      {
        "stt": 40,
        "tit": "Trẻ thơ bỡn cợt lòng thiền rối - Vượn cắp đao về Mộc mẫu trơ.",
        "url": ["", "", "", ""],
        "dur": "33:19",
        "img": "NpPmviJYOPk",
        "oUrl": "wmeUGWm7tlA"
      },
      {
        "stt": 41,
        "tit": "Hành Giả gặp lửa thua - Bát Giới bị ma bắt.",
        "url": ["", "", "", ""],
        "dur": "39:22",
        "img": "_8E4YpQtBe0",
        "oUrl": "B287CXIXnEc"
      },
      {
        "stt": 42,
        "tit": "Đại Thánh ân cần cầu Bồ Tát - Quan Âm từ thiện trói Hồng Hài.",
        "url": ["", "", "", ""],
        "dur": "35:14",
        "img": "RKxWVSDjvcE",
        "oUrl": "tM1ivhwSDY0"
      },
      {
        "stt": 43,
        "tit": "Ma sông Hắc Thủy bắt Tam Tạng - Rồng biển Tây Dương tóm Đà Long.",
        "url": ["", "", "", ""],
        "dur": "1:00:12",
        "img": "B3CY8eedfkQ",
        "oUrl": "UZfSgmEdDmU"
      },
      {
        "stt": 44,
        "tit": "Thần thông vận phép đun xe nặng - Tâm chính trừ yêu vượt cổng cao.",
        "url": ["", "", "", ""],
        "dur": "36:45",
        "img": "hcrbHcORSdo",
        "oUrl": "680SImsQFvw"
      },
      {
        "stt": 45,
        "tit": "Quán Tam Thanh, Đại Thánh lưu danh - Nước Xa Trì, Hầu Vương hóa phép.",
        "url": ["", "", "", ""],
        "dur": "31:59",
        "img": "iwgaW3kZFm8",
        "oUrl": "BoDA4kC4nXA"
      },
      {
        "stt": 46,
        "tit": "Ngoại đạo cậy tài lừa chính pháp - Ngộ Không hiển thánh diệt tà ma.",
        "url": ["", "", "", ""],
        "dur": "1:00:16",
        "img": "G0cGpE0M_P4",
        "oUrl": "r7vyYQcr4fk"
      },
      {
        "stt": 47,
        "tit": "Thánh Tăng đêm vướng sông Thông Thiên - Hành Giả thương tình cứu con trẻ.",
        "url": ["", "", "", ""],
        "dur": "36:45",
        "img": "GKqEED_YTsU",
        "oUrl": "FikFAwmcyIA"
      },
      {
        "stt": 48,
        "tit": "Ma nổi gió hàn sa tuyết lớn - Sư mong bái Phật giẫm băng dày.",
        "url": ["", "", "", ""],
        "dur": "32:16",
        "img": "Xl-ed5nL7Ew",
        "oUrl": "C7QkTgEsaek"
      },
      {
        "stt": 49,
        "tit": "Tam Tạng gặp nạn chìm đáy sông - Quan Âm trừ tai hiện làng cá.",
        "url": ["", "", "", ""],
        "dur": "33:18",
        "img": "9fgu99ThQmE",
        "oUrl": "2jrnMaYRkXY"
      },
      {
        "stt": 50,
        "tit": "Tình loạn, tính theo vì ái dục - Thần mờ, tâm động gặp yêu ma.",
        "url": ["", "", "", ""],
        "dur": "47:38",
        "img": "zE8L5z12ybA",
        "oUrl": "b5riVniuJfk"
      },
      {
        "stt": 51,
        "tit": "Nghìn mưu Đại Thánh thành vô dụng - Nước lửa không công khó diệt ma.",
        "url": ["", "", "", ""],
        "dur": "33:14",
        "img": "NP8a1ziiMJA",
        "oUrl": "BL7Z8GRIyao"
      },
      {
        "stt": 52,
        "tit": "Ngộ Không đại náo động Kim Đâu - Như Lai ngầm mách cho ông chủ.",
        "url": ["", "", "", ""],
        "dur": "35:48",
        "img": "fV6UzLp7egQ",
        "oUrl": "zdnuMSC8PXw"
      },
      {
        "stt": 53,
        "tit": "Uống nước sông, Tam Tạng mang nghén quỷ - Đi lấy nước, Sa Tăng giải thai ma.",
        "url": ["", "", "", ""],
        "dur": "35:28",
        "img": "JauuN_h3NEk",
        "oUrl": "odbqD-JOraw"
      },
      {
        "stt": 54,
        "tit": "Tam Tạng sang Tây qua nước gái - Ngộ Không lập mẹo thoát trăng hoa.",
        "url": ["", "", "", ""],
        "dur": "35:45",
        "img": "CFN5qN3rv4I",
        "oUrl": "zVS2mTlfg_c"
      },
      {
        "stt": 55,
        "tit": "Dâm tà bỡn cợt Đường Tam Tạng - Đứng đắn tu trì chẳng hoại thân.",
        "url": ["", "", "", ""],
        "dur": "33:54",
        "img": "GNnouGPB4Z8",
        "oUrl": "OzZINAIGvl4"
      },
      {
        "stt": 56,
        "tit": "Điên lòng trừ giặc cỏ - Mê đạo đuổi Ngộ Không.",
        "url": ["", "", "", ""],
        "dur": "37:37",
        "img": "MggPD_EMZsA",
        "oUrl": "M6cgSipbszI"
      },
      {
        "stt": 57,
        "tit": "Núi Lạc Già, Hành Giả thật kể khổ - Động Thủy Liêm, Hầu Vương giả đọc văn.",
        "url": ["", "", "", ""],
        "dur": "31:45",
        "img": "iodzyklEl3c",
        "oUrl": "LnmtPkCUBXQ"
      },
      {
        "stt": 58,
        "tit": "Nhị tâm làm loạn càn khôn rộng - Một thể khó tu tịch diệt chân.",
        "url": ["", "", "", ""],
        "dur": "31:02",
        "img": "jmlJ4drNEkc",
        "oUrl": "ZmM9uDyA9KE"
      },
      {
        "stt": 59,
        "tit": "Tam Tạng gặp Hỏa Diệm Sơn nghẽn lối - Hành Giả lần đầu mượn quạt Ba Tiêu.",
        "url": ["", "", "", ""],
        "dur": "36:00",
        "img": "Q_10ZjYjzbQ",
        "oUrl": "nmuNEyPfzoc"
      },
      {
        "stt": 60,
        "tit": "Ma vương ngừng đánh đi dự tiệc rượu - Hành Giả hai lần mượn quạt Ba Tiêu.",
        "url": ["", "", "", ""],
        "dur": "49:45",
        "img": "QcCwoePAFo0",
        "oUrl": "yHR8sU-aRTU"
      },
      {
        "stt": 61,
        "tit": "Bát Giới giúp sức đánh bại yêu quái - Hành Giả lần ba mượn quạt Ba Tiêu.",
        "url": ["", "", "", ""],
        "dur": "34:30",
        "img": "6RUdtwIkum0",
        "oUrl": "wPTbQ_vfdMw"
      },
      {
        "stt": 62,
        "tit": "Tắm bụi rửa tâm lên quét tháp - Bắt ma về chủ ấy tu thân.",
        "url": ["", "", "", ""],
        "dur": "32:53",
        "img": "HjDjDrQOT8A",
        "oUrl": "13dl2rh19FQ"
      },
      {
        "stt": 63,
        "tit": "Hai sư diệt quái náo long cung - Các thánh trừ tà thu bảo bối.",
        "url": ["", "", "", ""],
        "dur": "31:51",
        "img": "5zejWa1IQWE",
        "oUrl": "0fdU6pkq2sw"
      },
      {
        "stt": 64,
        "tit": "Núi Kinh Cát, Ngộ Năng gắng sức - Am Mộc Tiên, Tam Tạng làm thơ.",
        "url": ["", "", "", ""],
        "dur": "36:50",
        "img": "u9JApTxQlqo",
        "oUrl": "pCgtoNdv5Io"
      },
      {
        "stt": 65,
        "tit": "Yêu ma bày đặt Lôi Âm giả - Thầy trò đều gặp ách nạn to.",
        "url": ["", "", "", ""],
        "dur": "41:50",
        "img": "LHArpJBpeOs",
        "oUrl": "e82RhrQr29M"
      },
      {
        "stt": 66,
        "tit": "Các thần gặp độc thủ - Di Lặc trói yêu ma.",
        "url": ["", "", "", ""],
        "dur": "32:28",
        "img": "3_Veh2otEuE",
        "oUrl": "sBHI-cmpA7M"
      },
      {
        "stt": 67,
        "tit": "Cứu xóm Đà La thiền tính vững - Thoát đường ô uế đạo tâm trong.",
        "url": ["", "", "", ""],
        "dur": "36:02",
        "img": "h26MYjtQJ9U",
        "oUrl": "g2TXKp5jhzQ"
      },
      {
        "stt": 68,
        "tit": "Nước Chu Tử, Đường Tăng bàn đời trước - Chữa quốc vương, Hành Giả đóng thầy lang.",
        "url": ["", "", "", ""],
        "dur": "32:50",
        "img": "Cj3_3-9HVRo",
        "oUrl": "9rkfwUbJgKI"
      },
      {
        "stt": 69,
        "tit": "Hành Giả nửa đêm điều thuốc tễ - Quân vương trên tiệc kể yêu ma.",
        "url": ["", "", "", ""],
        "dur": "32:58",
        "img": "SkgO3DZm-qc",
        "oUrl": "lwxe5JH9g60"
      },
      {
        "stt": 70,
        "tit": "Yêu ma rung vòng tung khói lửa - Hành Giả trộm nhạc tính mẹo lừa.",
        "url": ["", "", "", ""],
        "dur": "50:12",
        "img": "VuK6M6CeaBM",
        "oUrl": "xowhvgsHqH8"
      },
      {
        "stt": 71,
        "tit": "Hành Giả giả danh hàng quái sấu - Quan Âm hiện tướng phục Ma vương.",
        "url": ["", "", "", ""],
        "dur": "35:02",
        "img": "00QzIpx9ppA",
        "oUrl": "EVPtUj25Eeg"
      },
      {
        "stt": 72,
        "tit": "Động Bàn Ty bảy tinh mê gốc - Suối Trạc Cấu Bát Giới quên hình.",
        "url": ["", "", "", ""],
        "dur": "34:35",
        "img": "_58gNTjT3ok",
        "oUrl": "lxTxBp9ZnAo"
      },
      {
        "stt": 73,
        "tit": "Hận cũ bởi tình, gây nên đầu độc mới - Đường Tăng gặp nạn, Tỳ Lam phá hào quang.",
        "url": ["", "", "", ""],
        "dur": "34:45",
        "img": "Cl30zNEzB94",
        "oUrl": "40s8j_k6qhk"
      },
      {
        "stt": 74,
        "tit": "Trường Canh truyền báo ma hung dữ - Hành Giả ra tay trổ phép tài.",
        "url": ["", "", "", ""],
        "dur": "35:55",
        "img": "a06ORN4ovUA",
        "oUrl": "1Fip_QAxO9U"
      },
      {
        "stt": 75,
        "tit": "Hành Giả khoan thủng bình âm dương - Ma chúa theo về chân đại đạo.",
        "url": ["", "", "", ""],
        "dur": "34:52",
        "img": "JnKtFLcVsAE",
        "oUrl": "Clp5myZKcRo"
      },
      {
        "stt": 76,
        "tit": "Hành Giả tha về, ma theo tính cũ - Ngộ Năng cùng đánh, quái vẫn tâm xưa.",
        "url": ["", "", "", ""],
        "dur": "33:20",
        "img": "a6HksYs9SXI",
        "oUrl": "GVMy_zErTK4"
      },
      {
        "stt": 77,
        "tit": "Yêu ma lừa bản tính - Nhất thể bái chân như.",
        "url": ["", "", "", ""],
        "dur": "43:54",
        "img": "FoeMS3dExwo",
        "oUrl": "u7auikhDTYI"
      },
      {
        "stt": 78,
        "tit": "Nước Tỳ Khưu thương trẻ, khiến âm thần - Điện Kim Loan biết ma, bàn đạo đức.",
        "url": ["", "", "", ""],
        "dur": "41:48",
        "img": "X7hSXJ-AOig",
        "oUrl": "734U-xY5RVg"
      },
      {
        "stt": 79,
        "tit": "Tìm hang bắt quái gặp Thọ Tinh - Ra điện dạy vua mừng nhận trẻ.",
        "url": ["", "", "", ""],
        "dur": "29:58",
        "img": "ae_BPcswikI",
        "oUrl": "D4kPKsAQ2S4"
      },
      {
        "stt": 80,
        "tit": "Gái đẹp thèm lấy chồng, mừng được sánh đôi - Ngộ Không bảo vệ thầy, biết ngay yêu quái.",
        "url": ["", "", "", ""],
        "dur": "32:07",
        "img": "ntNuGfewAxE",
        "oUrl": "2dYOLSDhIqM"
      },
      {
        "stt": 81,
        "tit": "Chùa Trấn Hải, Ngộ Không biết quái - Rừng Hắc Tùng, đồ đệ tìm thầy.",
        "url": ["", "", "", ""],
        "dur": "41:30",
        "img": "AcZZcV0zzIY",
        "oUrl": "7BS-HvsSpWw"
      },
      {
        "stt": 82,
        "tit": "Gái đẹp tìm cách lấy chồng - Sư phụ bền lòng giữ đạo.",
        "url": ["", "", "", ""],
        "dur": "40:40",
        "img": "rDlw9FxD-Cs",
        "oUrl": "acwX69DIBh0"
      },
      {
        "stt": 83,
        "tit": "Ngộ Không biết rõ đầu đuôi - Gái đẹp lại về bản tính.",
        "url": ["", "", "", ""],
        "dur": "41:31",
        "img": "vtCHqQ2FlV0",
        "oUrl": "6uEO_Y0JjLM"
      },
      {
        "stt": 84,
        "tit": "Khó diệt nhà sư tròn giác ngộ - Phép vương thành đạo thể theo trời.",
        "url": ["", "", "", ""],
        "dur": "44:40",
        "img": "OsGY4oLSTrM",
        "oUrl": "pkgsg9tUQj8"
      },
      {
        "stt": 85,
        "tit": "Hành Giả đố kỵ lừa Bát Giới - Ma vương bày mẹo bắt Đường Tăng.",
        "url": ["", "", "", ""],
        "dur": "34:38",
        "img": "o3C0sKE86hw",
        "oUrl": "X65Dd1FRa04"
      },
      {
        "stt": 86,
        "tit": "Bát Giới giúp oai trừ quái vật - Ngộ Không trổ phép diệt yêu tà.",
        "url": ["", "", "", ""],
        "dur": "32:22",
        "img": "DQdYzD_fmqI",
        "oUrl": "MXhluNYYV7Y"
      },
      {
        "stt": 87,
        "tit": "Quận Phượng Tiên khinh trời bị hạn - Tôn Đại Thánh khuyến thiện làm mưa.",
        "url": ["", "", "", ""],
        "dur": "39:09",
        "img": "amtlW9tFmgE",
        "oUrl": "Hvk9AFZa994"
      },
      {
        "stt": 88,
        "tit": "Thiền đến Ngọc Hoa thi võ nghệ - Ba trò xin phép nhận môn đồ.",
        "url": ["", "", "", ""],
        "dur": "36:15",
        "img": "nNRWmdpARF8",
        "oUrl": "AcbDvR75bnE"
      },
      {
        "stt": 89,
        "tit": "Quái Hoàng Sư hỏng mất hội đinh ba - Ba đồ đệ đại náo núi Đầu Báo.",
        "url": ["", "", "", ""],
        "dur": "36:31",
        "img": "X8b0mwT-VH0",
        "oUrl": "OZNjj2Nlsq8"
      },
      {
        "stt": 90,
        "tit": "Quái Sư Tử bắt thầy trò Tam Tạng - Tiên Thiên Tôn thu yêu quái chín đầu.",
        "url": ["", "", "", ""],
        "dur": "39:26",
        "img": "y3pV0NAoKo8",
        "oUrl": "lmJHsuiAzIg"
      },
      {
        "stt": 91,
        "tit": "Phủ Kim Bình đêm nguyên tiêu xem hội - Động Huyền Anh Đường Tam Tạng khai cung.",
        "url": ["", "", "", ""],
        "dur": "40:36",
        "img": "d-SLz13k3zA",
        "oUrl": "REh-xS6A22U"
      },
      {
        "stt": 92,
        "tit": "Ba sư đại chiến núi Thanh Long - Bốn sao vây bắt quái tê giác.",
        "url": ["", "", "", ""],
        "dur": "41:10",
        "img": "uYv0VUjWkpU",
        "oUrl": "_G9ATfGp6N0"
      },
      {
        "stt": 93,
        "tit": "Vườn Cấp Cô hỏi cổ bàn nguồn - Nước Thiên Trúc chầu vua được vợ.",
        "url": ["", "", "", ""],
        "dur": "45:34",
        "img": "Y_QwSu58wuU",
        "oUrl": "4tdtAw1eflk"
      },
      {
        "stt": 94,
        "tit": "Bốn sư dự tiệc vườn thượng uyển - Một quái mơ màng tình ái vui.",
        "url": ["", "", "", ""],
        "dur": "30:05",
        "img": "eVlfIfBJ9K8",
        "oUrl": "CBT93RwC9Pc"
      },
      {
        "stt": 95,
        "tit": "Giả hợp chân hình bắt thỏ ngọc - Chân âm về chính gặp nguồn thiêng.",
        "url": ["", "", "", ""],
        "dur": "36:19",
        "img": "Q41TQD0mxJA",
        "oUrl": "Cbm71A4LUQo"
      },
      {
        "stt": 96,
        "tit": "Khấu viên ngoại mừng đãi cao tăng - Đường trưởng lão không màng phú quý.",
        "url": ["", "", "", ""],
        "dur": "36:05",
        "img": "bq6WLzKtxL4",
        "oUrl": "mc6suL-mghg"
      },
      {
        "stt": 97,
        "tit": "Vàng mang trả gây thành tai họa - Thánh hiện hồn cứu thoát cao tăng.",
        "url": ["", "", "", ""],
        "dur": "51:38",
        "img": "LF8ckBEYmG8",
        "oUrl": "zcMcWOEqXJg"
      },
      {
        "stt": 98,
        "tit": "Vượn ngựa thục thuần nay thoát xác - Công quả viên mãn gặp Như Lai.",
        "url": ["", "", "", ""],
        "dur": "49:04",
        "img": "apN1mUyMZg8",
        "oUrl": "lLavNWEkyKI"
      },
      {
        "stt": 99,
        "tit": "Tám mươi mốt nạn yêu ma hết - Vẹn tròn công quả đạo về nguồn.",
        "url": ["", "", "", ""],
        "dur": "29:41",
        "img": "ab7nnz3tgKw",
        "oUrl": "HdjxTsCijok"
      },
      {
        "stt": 100,
        "tit": "Về thẳng phương Đông - Năm Thánh thành Phật.",
        "url": [
          ""                                                              ,
          "https://archive.org/download/tay-du-ky.sna/TayDuKi100Het_2.mp3",
          ""                                                              ,
          ""
        ],
        "dur": "41:51",
        "img": "69-RT5ofnDo",
        "oUrl": "k5CbiAzCA_U"
      }
    ]
  },
  {
    "title": "Tây Du Ký",
    "eTitle": "Journey to the West",
    "author": "Ngô Thừa Ân",
    "type": "Tiểu thuyết thần ma",
    "mc": "VDC Audio",
    "cover": "https://thuviensach.vn/img/news/2022/09/larger/1160-tay-du-ky-1.jpg",
    "ssrc": [
      "https://kenhsachnoi.com/nghe/tay-du-ky#fwdrapPlayer0?catid=14&trackid=0",
      "https://archive.org/details/kenhsachnoi.com-tay-du-ky/",
      "https://www.youtube.com/playlist?list=PLIy8AxblUN2NBYBpAiZEqyJRh6c9nV3eH"
    ],
    "grp": ["TDK.TDK$5", "TDK.TDK", "TDK.TDK"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 3,
          "wcSrc": "https://archive.org/download/kenhsachnoi.com-tay-du-ky/<*~~*>.Tay-Du-Ky_tac-gia_Ngo-Thua-An_(KenhSachNoi.Com).mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aipwRW8eqAaxVOMQ_XBkBaxb"
    },
	"tap" : [
		{"label": "Chương 1 đến chương 10", "f": 1, "t": 10},
		{"label": "Chương 11 đến chương 20", "f": 11, "t": 20},
		{"label": "Chương 21 đến chương 30", "f": 21, "t": 30},
		{"label": "Chương 31 đến chương 40", "f": 31, "t": 40},
		{"label": "Chương 41 đến chương 50", "f": 41, "t": 50},
		{"label": "Chương 51 đến chương 60", "f": 51, "t": 60},
		{"label": "Chương 61 đến chương 70", "f": 61, "t": 70},
		{"label": "Chương 71 đến chương 80", "f": 71, "t": 80},
		{"label": "Chương 81 đến chương 90", "f": 81, "t": 90},
		{"label": "Chương 91 đến chương 100", "f": 91, "t": 100}
	],
    "year": "1590",
    "intro": "<b>Tây Du Ký</b> (phồn thể: 西遊記; giản thể: 西游记; bính âm: Xī Yóu Jì; Wade-Giles: Hsi Yu Chi), là một trong những tác phẩm kinh điển trong văn học Trung Hoa. Được xuất bản với tác giả giấu tên trong những năm 1590 và không có bằng chứng trực tiếp còn tồn tại để biết tác giả của nó, nhưng tác phẩm này thường được cho là của tác giả Ngô Thừa Ân. Tiểu thuyết thuật lại chuyến đi đến Ấn Độ của nhà sư Huyền Trang (Đường Tam Tạng) đi lấy kinh.<br/>Trong tiểu thuyết, Trần Huyền Trang (陳玄奘) được Quan Âm Bồ Tát bảo đến Tây Trúc (Ấn Độ) thỉnh kinh Phật giáo mang về Trung Quốc. Theo ông là 4 đệ tử - một khỉ đá tên Tôn Ngộ Không (孫悟空), một yêu quái nửa người nửa lợn tên Trư Ngộ Năng (豬悟能) và một thủy quái tên Sa Ngộ Tĩnh (沙悟淨) - họ đều đồng ý theo ông đi thỉnh kinh để chuộc tội. Con ngựa Huyền Trang cưỡi cũng là một hoàng tử của Long Vương (Bạch Long Mã).<br/>Đường đi gặp biết bao gian nan trắc trở, bao hiểm nguy mà thầy trò Đường Tam Tạng phải đối đầu, trong đó nhiều yêu quái là đồ đệ của các vị Tiên, Phật. Một số yêu tinh muốn ăn thịt Huyền Trang, một số khác muốn cám dỗ họ bằng cách biến thành những mỹ nhân. Tôn Ngộ Không phải sử dụng phép thuật và quan hệ của mình với thế giới yêu quái và Tiên, Phật để đánh bại các kẻ thù nhiều mánh khóe, như Ngưu Ma Vương hay Thiết Phiến Công chúa,...<br/>Cuối cùng, sau 81 kiếp nạn, bốn thầy trò cũng đến được xứ sở của Phật tổ, mang kinh Phật truyền bá về phương Đông.",
    "parts": [
      {
        "stt": 1,
        "tit": "Gốc thiêng ấp ủ nguồn rộng chảy - Tâm tính sửa sang đạo lớn sinh.",
        "url": [""],
        "dur": "26:42",
        "img": "F7vSAArIO_c"
      },
      {
        "stt": 2,
        "tit": "Thấu lẽ Bồ Đề là diệu lý - Bỏ ma về gốc ấy nguyên thần.",
        "url": [""],
        "dur": "36:53",
        "img": "IjVauOuJdqE"
      },
      {
        "stt": 3,
        "tit": "Bốn biển nghìn non đều sợ phục - Mười loại âm ti thảy xóa tên.",
        "url": [""],
        "dur": "37:49",
        "img": "6asqax8PArw"
      },
      {
        "stt": 4,
        "tit": "Quan phong Bật Mã lòng đâu thỏa - Tên gọi Tề Thiên dạ chẳng yên.",
        "url": [""],
        "dur": "30:19",
        "img": "LRvAuUAxmOE"
      },
      {
        "stt": 5,
        "tit": "Loạn vườn đào Đại Thánh trộm thuốc tiên - Về thiên cung các thần bắt yêu quái.",
        "url": [""],
        "dur": "28:48",
        "img": "W8LN2y9lcuk"
      },
      {
        "stt": 6,
        "tit": "Quan Âm dự hội hỏi nguyên nhân - Tiểu Thánh trổ tài bắt Đại Thánh.",
        "url": [""],
        "dur": "31:14",
        "img": "l7MBDDGZr9I"
      },
      {
        "stt": 7,
        "tit": "Đại Thánh trốn khỏi lò bát quái - Hầu vương giam dưới núi Ngũ hành.",
        "url": [""],
        "dur": "20:44",
        "img": "qdk0wyDk8mc"
      },
      {
        "stt": 8,
        "tit": "Phật Tổ tạo kinh truyền cực lạc - Quan Âm vâng mệnh đến Tràng An.",
        "url": [""],
        "dur": "28:01",
        "img": "dZId6AFk77Q"
      },
      {
        "stt": 9,
        "tit": "Trần Quang Nhị nhậm chức gặp nạn - Sư Giang Lưu phục thù báo ơn.",
        "url": [""],
        "dur": "35:17",
        "img": "xvW0mi61crs"
      },
      {
        "stt": 10,
        "tit": "Lão Long vương vụng kế phạm phép trời - Ngụy Thừa tướng gửi thư nhờ âm sứ.",
        "url": [""],
        "dur": "49:01",
        "img": "0DavzESpg4A"
      },
      {
        "stt": 11,
        "tit": "Chơi âm phủ Thái Tông về trần - Dâng quả bí Lưu Toàn gặp vợ.",
        "url": [""],
        "dur": "33:02",
        "img": "n1XAMFp7UOE"
      },
      {
        "stt": 12,
        "tit": "Vua Đường lòng thành mở đại hội - Quan Âm hiển thánh hóa Kim Thiền.",
        "url": [""],
        "dur": "26:56",
        "img": "T0gK67UuKZM"
      },
      {
        "stt": 13,
        "tit": "Sa hang cọp Kim Tinh cứu thoát - Núi Song Xoa Bá Khâm mời sư.",
        "url": [""],
        "dur": "27:16",
        "img": "shUW-2O0HdM"
      },
      {
        "stt": 14,
        "tit": "Lòng vượn theo đường chính - Sáu giặc mất tăm hơi.",
        "url": [""],
        "dur": "38:20",
        "img": "3d9QCFZORn4"
      },
      {
        "stt": 15,
        "tit": "Núi Xà Bàn các thần ngầm giúp - Khe Ưng Sầu long mã thắng cương.",
        "url": [""],
        "dur": "31:21",
        "img": "xcqypylXzCo"
      },
      {
        "stt": 16,
        "tit": "Viện Quan Âm, các sư lừa bảo bối - Núi Hắc Phong, yêu quái lấy trộm cà sa.",
        "url": [""],
        "dur": "34:53",
        "img": "T9L9apfkOmo"
      },
      {
        "stt": 17,
        "tit": "Tôn Hành Giả đại náo núi Hắc Phong - Quan Thế Âm thu phục yêu tinh gấu.",
        "url": [""],
        "dur": "36:21",
        "img": "hxZqOatDCfw"
      },
      {
        "stt": 18,
        "tit": "Chùa Quan Âm, Đường Tăng thoát nạn - Thôn Cao Lão, Đại Thánh trừ ma.",
        "url": [""],
        "dur": "26:40",
        "img": "fc3J9KFvmtg"
      },
      {
        "stt": 19,
        "tit": "Động Vân Sạn, Ngộ Không thu Bát Giới - Núi Phù Đồ, Tam Tạng nhận Tâm kinh.",
        "url": [""],
        "dur": "30:10",
        "img": "ZyWoEHnx6C0"
      },
      {
        "stt": 20,
        "tit": "Núi Hoàng Phong, Đường Tăng gặp nạn - Giữa rừng thẳm, Bát Giới lập công",
        "url": [""],
        "dur": "28:23",
        "img": "VSPDkK21xeM"
      },
      {
        "stt": 21,
        "tit": "Hộ pháp dựng nhà lưu Đại Thánh - Tu Di Linh Cát bắt yêu ma.",
        "url": [""],
        "dur": "29:38",
        "img": "sScVe7Loo3Y"
      },
      {
        "stt": 22,
        "tit": "Bát Giới đại chiến sông Lưu Sa - Mộc Soa vâng lệnh bắt Ngộ Tĩnh.",
        "url": [""],
        "dur": "29:10",
        "img": "UhA7b4MFkdw"
      },
      {
        "stt": 23,
        "tit": "Tam Tạng không quên gốc - Bốn Thánh thử lòng thiền.",
        "url": [""],
        "dur": "33:47",
        "img": "S84Yy_t9VlY"
      },
      {
        "stt": 24,
        "tit": "Núi Vạn Thọ, Đại tiên lưu bạn cũ - Quán Ngũ Trang, Hành Giả trộm nhân sâm.",
        "url": [""],
        "dur": "33:12",
        "img": "n_p7T-EDKXI"
      },
      {
        "stt": 25,
        "tit": "Trấn Nguyên đại tiên đuổi bắt người lấy kinh - Tôn Hành Giả đại náo Ngũ Trang quán.",
        "url": [""],
        "dur": "34:13",
        "img": "vC6w9kPdnzw"
      },
      {
        "stt": 26,
        "tit": "Khắp ba đảo, Ngộ Không tìm thuốc - Nước Cam Lộ, Bồ Tát chữa cây.",
        "url": [""],
        "dur": "34:45",
        "img": "vUSdaN8a630"
      },
      {
        "stt": 27,
        "tit": "Thây ma ba lượt trêu Tam Tạng - Đường Tăng giận đuổi Mỹ Hầu Vương.",
        "url": [""],
        "dur": "33:53",
        "img": "a0sDgAe3nCk"
      },
      {
        "stt": 28,
        "tit": "Núi Hoa Quả lũ yêu tụ nghĩa - Rừng Hắc Tùng Tam Tạng gặp ma.",
        "url": [""],
        "dur": "29:33",
        "img": "4S8AfqOVOeY"
      },
      {
        "stt": 29,
        "tit": "Thoát nạn Giáng Lưu sang nước khác - Đội ơn Bát Giới chuyển non ngàn.",
        "url": [""],
        "dur": "30:11",
        "img": "zdZn0g1YUqE"
      },
      {
        "stt": 30,
        "tit": "Tà ma phạm chính đạo - Tiểu Long nhớ Ngộ Không.",
        "url": [""],
        "dur": "37:53",
        "img": "LiiG0b5mDnE"
      },
      {
        "stt": 31,
        "tit": "Trư Bát Giới lấy nghĩa khích Hầu Vương - Tôn Ngộ Không dùng mưu hàng yêu quái.",
        "url": [""],
        "dur": "39:54",
        "img": "rpyz6G0BwtA"
      },
      {
        "stt": 32,
        "tit": "Núi Bình Đính, Công tào truyền tín - Động Liên Hoa, Bát Giới gặp tai.",
        "url": [""],
        "dur": "37:32",
        "img": "OQ556_z_q84"
      },
      {
        "stt": 33,
        "tit": "Ngoại đạo mê chân tính - Nguyên thần giúp bản tâm.",
        "url": [""],
        "dur": "40:03",
        "img": "pRjLYXH_YCA"
      },
      {
        "stt": 34,
        "tit": "Ma vương giỏi mẹo khốn Hầu Vương - Đại Thánh khéo lừa thay bảo bối.",
        "url": [""],
        "dur": "39:43",
        "img": "ReZ2T81jA4g"
      },
      {
        "stt": 35,
        "tit": "Ngoại đạo ra oai lừa tính thẳng - Ngộ Không được báu thắng yêu ma.",
        "url": [""],
        "dur": "33:46",
        "img": "o_1NJtBUVYY"
      },
      {
        "stt": 36,
        "tit": "Ngộ Không xử đúng muôn duyên phục - Đạo tà phá bỏ thấy trăng soi.",
        "url": [""],
        "dur": "35:29",
        "img": "1u2WaQ0n4Cw"
      },
      {
        "stt": 37,
        "tit": "Đêm khuya vua quỷ cầu Tam Tạng - Hóa phép Ngộ Không dắt trẻ thơ.",
        "url": [""],
        "dur": "44:16",
        "img": "jSkXB7IJigA"
      },
      {
        "stt": 38,
        "tit": "Trẻ thơ hỏi mẹ tà hay chính - Kim Mộc thăm dò rõ thực hư.",
        "url": [""],
        "dur": "39:09",
        "img": "v9ALk8CzzCU"
      },
      {
        "stt": 39,
        "tit": "Một hạt linh đơn xin thượng giới - Ba năm vua cũ lại hồi sinh.",
        "url": [""],
        "dur": "39:17",
        "img": "hv10Gdybkuw"
      },
      {
        "stt": 40,
        "tit": "Trẻ thơ bỡn cợt lòng thiền rối - Vượn cắp đao về Mộc mẫu trơ.",
        "url": [""],
        "dur": "38:21",
        "img": "NpPmviJYOPk"
      },
      {
        "stt": 41,
        "tit": "Hành Giả gặp lửa thua - Bát Giới bị ma bắt.",
        "url": [""],
        "dur": "39:21",
        "img": "_8E4YpQtBe0"
      },
      {
        "stt": 42,
        "tit": "Đại Thánh ân cần cầu Bồ Tát - Quan Âm từ thiện trói Hồng Hài.",
        "url": [""],
        "dur": "43:13",
        "img": "RKxWVSDjvcE"
      },
      {
        "stt": 43,
        "tit": "Ma sông Hắc Thủy bắt Tam Tạng - Rồng biển Tây Dương tóm Đà Long.",
        "url": [""],
        "dur": "41:00",
        "img": "B3CY8eedfkQ"
      },
      {
        "stt": 44,
        "tit": "Thần thông vận phép đun xe nặng - Tâm chính trừ yêu vượt cổng cao.",
        "url": [""],
        "dur": "43:26",
        "img": "hcrbHcORSdo"
      },
      {
        "stt": 45,
        "tit": "Quán Tam Thanh, Đại Thánh lưu danh - Nước Xa Trì, Hầu Vương hóa phép.",
        "url": [""],
        "dur": "39:29",
        "img": "iwgaW3kZFm8"
      },
      {
        "stt": 46,
        "tit": "Ngoại đạo cậy tài lừa chính pháp - Ngộ Không hiển thánh diệt tà ma.",
        "url": [""],
        "dur": "43:28",
        "img": "G0cGpE0M_P4"
      },
      {
        "stt": 47,
        "tit": "Thánh Tăng đêm vướng sông Thông Thiên - Hành Giả thương tình cứu con trẻ.",
        "url": [""],
        "dur": "42:54",
        "img": "GKqEED_YTsU"
      },
      {
        "stt": 48,
        "tit": "Ma nổi gió hàn sa tuyết lớn - Sư mong bái Phật giẫm băng dày.",
        "url": [""],
        "dur": "36:04",
        "img": "Xl-ed5nL7Ew"
      },
      {
        "stt": 49,
        "tit": "Tam Tạng gặp nạn chìm đáy sông - Quan Âm trừ tai hiện làng cá.",
        "url": [""],
        "dur": "40:06",
        "img": "9fgu99ThQmE"
      },
      {
        "stt": 50,
        "tit": "Tình loạn, tính theo vì ái dục - Thần mờ, tâm động gặp yêu ma.",
        "url": [""],
        "dur": "34:56",
        "img": "zE8L5z12ybA"
      },
      {
        "stt": 51,
        "tit": "Nghìn mưu Đại Thánh thành vô dụng - Nước lửa không công khó diệt ma.",
        "url": [""],
        "dur": "39:20",
        "img": "NP8a1ziiMJA"
      },
      {
        "stt": 52,
        "tit": "Ngộ Không đại náo động Kim Đâu - Như Lai ngầm mách cho ông chủ.",
        "url": [""],
        "dur": "36:54",
        "img": "fV6UzLp7egQ"
      },
      {
        "stt": 53,
        "tit": "Uống nước sông, Tam Tạng mang nghén quỷ - Đi lấy nước, Sa Tăng giải thai ma.",
        "url": [""],
        "dur": "38:18",
        "img": "JauuN_h3NEk"
      },
      {
        "stt": 54,
        "tit": "Tam Tạng sang Tây qua nước gái - Ngộ Không lập mẹo thoát trăng hoa.",
        "url": [""],
        "dur": "40:05",
        "img": "CFN5qN3rv4I"
      },
      {
        "stt": 55,
        "tit": "Dâm tà bỡn cợt Đường Tam Tạng - Đứng đắn tu trì chẳng hoại thân.",
        "url": [""],
        "dur": "40:14",
        "img": "GNnouGPB4Z8"
      },
      {
        "stt": 56,
        "tit": "Điên lòng trừ giặc cỏ - Mê đạo đuổi Ngộ Không.",
        "url": [""],
        "dur": "39:17",
        "img": "MggPD_EMZsA"
      },
      {
        "stt": 57,
        "tit": "Núi Lạc Già, Hành Giả thật kể khổ - Động Thủy Liêm, Hầu Vương giả đọc văn.",
        "url": [""],
        "dur": "34:37",
        "img": "iodzyklEl3c"
      },
      {
        "stt": 58,
        "tit": "Nhị tâm làm loạn càn khôn rộng - Một thể khó tu tịch diệt chân.",
        "url": [""],
        "dur": "35:44",
        "img": "jmlJ4drNEkc"
      },
      {
        "stt": 59,
        "tit": "Tam Tạng gặp Hỏa Diệm Sơn nghẽn lối - Hành Giả lần đầu mượn quạt Ba Tiêu.",
        "url": [""],
        "dur": "38:57",
        "img": "Q_10ZjYjzbQ"
      },
      {
        "stt": 60,
        "tit": "Ma vương ngừng đánh đi dự tiệc rượu - Hành Giả hai lần mượn quạt Ba Tiêu.",
        "url": [""],
        "dur": "36:58",
        "img": "QcCwoePAFo0"
      },
      {
        "stt": 61,
        "tit": "Bát Giới giúp sức đánh bại yêu quái - Hành Giả lần ba mượn quạt Ba Tiêu.",
        "url": [""],
        "dur": "34:42",
        "img": "6RUdtwIkum0"
      },
      {
        "stt": 62,
        "tit": "Tắm bụi rửa tâm lên quét tháp - Bắt ma về chủ ấy tu thân.",
        "url": [""],
        "dur": "34:57",
        "img": "HjDjDrQOT8A"
      },
      {
        "stt": 63,
        "tit": "Hai sư diệt quái náo long cung - Các thánh trừ tà thu bảo bối.",
        "url": [""],
        "dur": "34:50",
        "img": "5zejWa1IQWE"
      },
      {
        "stt": 64,
        "tit": "Núi Kinh Cát, Ngộ Năng gắng sức - Am Mộc Tiên, Tam Tạng làm thơ.",
        "url": [""],
        "dur": "37:22",
        "img": "u9JApTxQlqo"
      },
      {
        "stt": 65,
        "tit": "Yêu ma bày đặt Lôi Âm giả - Thầy trò đều gặp ách nạn to.",
        "url": [""],
        "dur": "32:31",
        "img": "LHArpJBpeOs"
      },
      {
        "stt": 66,
        "tit": "Các thần gặp độc thủ - Di Lặc trói yêu ma.",
        "url": [""],
        "dur": "32:11",
        "img": "3_Veh2otEuE"
      },
      {
        "stt": 67,
        "tit": "Cứu xóm Đà La thiền tính vững - Thoát đường ô uế đạo tâm trong.",
        "url": [""],
        "dur": "35:49",
        "img": "h26MYjtQJ9U"
      },
      {
        "stt": 68,
        "tit": "Nước Chu Tử, Đường Tăng bàn đời trước - Chữa quốc vương, Hành Giả đóng thầy lang.",
        "url": [""],
        "dur": "34:41",
        "img": "Cj3_3-9HVRo"
      },
      {
        "stt": 69,
        "tit": "Hành Giả nửa đêm điều thuốc tễ - Quân vương trên tiệc kể yêu ma.",
        "url": [""],
        "dur": "35:48",
        "img": "SkgO3DZm-qc"
      },
      {
        "stt": 70,
        "tit": "Yêu ma rung vòng tung khói lửa - Hành Giả trộm nhạc tính mẹo lừa.",
        "url": [""],
        "dur": "37:21",
        "img": "VuK6M6CeaBM"
      },
      {
        "stt": 71,
        "tit": "Hành Giả giả danh hàng quái sấu - Quan Âm hiện tướng phục Ma vương.",
        "url": [""],
        "dur": "36:51",
        "img": "00QzIpx9ppA"
      },
      {
        "stt": 72,
        "tit": "Động Bàn Ty bảy tinh mê gốc - Suối Trạc Cấu Bát Giới quên hình.",
        "url": [""],
        "dur": "36:46",
        "img": "_58gNTjT3ok"
      },
      {
        "stt": 73,
        "tit": "Hận cũ bởi tình, gây nên đầu độc mới - Đường Tăng gặp nạn, Tỳ Lam phá hào quang.",
        "url": [""],
        "dur": "38:13",
        "img": "Cl30zNEzB94"
      },
      {
        "stt": 74,
        "tit": "Trường Canh truyền báo ma hung dữ - Hành Giả ra tay trổ phép tài.",
        "url": [""],
        "dur": "37:42",
        "img": "a06ORN4ovUA"
      },
      {
        "stt": 75,
        "tit": "Hành Giả khoan thủng bình âm dương - Ma chúa theo về chân đại đạo.",
        "url": [""],
        "dur": "38:15",
        "img": "JnKtFLcVsAE"
      },
      {
        "stt": 76,
        "tit": "Hành Giả tha về, ma theo tính cũ - Ngộ Năng cùng đánh, quái vẫn tâm xưa.",
        "url": [""],
        "dur": "37:45",
        "img": "a6HksYs9SXI"
      },
      {
        "stt": 77,
        "tit": "Yêu ma lừa bản tính - Nhất thể bái chân như.",
        "url": [""],
        "dur": "38:43",
        "img": "FoeMS3dExwo"
      },
      {
        "stt": 78,
        "tit": "Nước Tỳ Khưu thương trẻ, khiến âm thần - Điện Kim Loan biết ma, bàn đạo đức.",
        "url": [""],
        "dur": "31:55",
        "img": "X7hSXJ-AOig"
      },
      {
        "stt": 79,
        "tit": "Tìm hang bắt quái gặp Thọ Tinh - Ra điện dạy vua mừng nhận trẻ.",
        "url": [""],
        "dur": "32:08",
        "img": "ae_BPcswikI"
      },
      {
        "stt": 80,
        "tit": "Gái đẹp thèm lấy chồng, mừng được sánh đôi - Ngộ Không bảo vệ thầy, biết ngay yêu quái.",
        "url": [""],
        "dur": "36:43",
        "img": "ntNuGfewAxE"
      },
      {
        "stt": 81,
        "tit": "Chùa Trấn Hải, Ngộ Không biết quái - Rừng Hắc Tùng, đồ đệ tìm thầy.",
        "url": [""],
        "dur": "34:24",
        "img": "AcZZcV0zzIY"
      },
      {
        "stt": 82,
        "tit": "Gái đẹp tìm cách lấy chồng - Sư phụ bền lòng giữ đạo.",
        "url": [""],
        "dur": "35:13",
        "img": "rDlw9FxD-Cs"
      },
      {
        "stt": 83,
        "tit": "Ngộ Không biết rõ đầu đuôi - Gái đẹp lại về bản tính.",
        "url": [""],
        "dur": "31:20",
        "img": "vtCHqQ2FlV0"
      },
      {
        "stt": 84,
        "tit": "Khó diệt nhà sư tròn giác ngộ - Phép vương thành đạo thể theo trời.",
        "url": [""],
        "dur": "33:59",
        "img": "OsGY4oLSTrM"
      },
      {
        "stt": 85,
        "tit": "Hành Giả đố kỵ lừa Bát Giới - Ma vương bày mẹo bắt Đường Tăng.",
        "url": [""],
        "dur": "36:19",
        "img": "o3C0sKE86hw"
      },
      {
        "stt": 86,
        "tit": "Bát Giới giúp oai trừ quái vật - Ngộ Không trổ phép diệt yêu tà.",
        "url": [""],
        "dur": "34:05",
        "img": "DQdYzD_fmqI"
      },
      {
        "stt": 87,
        "tit": "Quận Phượng Tiên khinh trời bị hạn - Tôn Đại Thánh khuyến thiện làm mưa.",
        "url": [""],
        "dur": "32:36",
        "img": "amtlW9tFmgE"
      },
      {
        "stt": 88,
        "tit": "Thiền đến Ngọc Hoa thi võ nghệ - Ba trò xin phép nhận môn đồ.",
        "url": [""],
        "dur": "31:36",
        "img": "nNRWmdpARF8"
      },
      {
        "stt": 89,
        "tit": "Quái Hoàng Sư hỏng mất hội đinh ba - Ba đồ đệ đại náo núi Đầu Báo.",
        "url": [""],
        "dur": "28:00",
        "img": "X8b0mwT-VH0"
      },
      {
        "stt": 90,
        "tit": "Quái Sư Tử bắt thầy trò Tam Tạng - Tiên Thiên Tôn thu yêu quái chín đầu.",
        "url": [""],
        "dur": "31:23",
        "img": "y3pV0NAoKo8"
      },
      {
        "stt": 91,
        "tit": "Phủ Kim Bình đêm nguyên tiêu xem hội - Động Huyền Anh Đường Tam Tạng khai cung.",
        "url": [""],
        "dur": "34:53",
        "img": "d-SLz13k3zA"
      },
      {
        "stt": 92,
        "tit": "Ba sư đại chiến núi Thanh Long - Bốn sao vây bắt quái tê giác.",
        "url": [""],
        "dur": "32:40",
        "img": "uYv0VUjWkpU"
      },
      {
        "stt": 93,
        "tit": "Vườn Cấp Cô hỏi cổ bàn nguồn - Nước Thiên Trúc chầu vua được vợ.",
        "url": [""],
        "dur": "33:12",
        "img": "Y_QwSu58wuU"
      },
      {
        "stt": 94,
        "tit": "Bốn sư dự tiệc vườn thượng uyển - Một quái mơ màng tình ái vui.",
        "url": [""],
        "dur": "27:45",
        "img": "eVlfIfBJ9K8"
      },
      {
        "stt": 95,
        "tit": "Giả hợp chân hình bắt thỏ ngọc - Chân âm về chính gặp nguồn thiêng.",
        "url": [""],
        "dur": "30:25",
        "img": "Q41TQD0mxJA"
      },
      {
        "stt": 96,
        "tit": "Khấu viên ngoại mừng đãi cao tăng - Đường trưởng lão không màng phú quý.",
        "url": [""],
        "dur": "28:04",
        "img": "bq6WLzKtxL4"
      },
      {
        "stt": 97,
        "tit": "Vàng mang trả gây thành tai họa - Thánh hiện hồn cứu thoát cao tăng.",
        "url": [""],
        "dur": "39:22",
        "img": "LF8ckBEYmG8"
      },
      {
        "stt": 98,
        "tit": "Vượn ngựa thục thuần nay thoát xác - Công quả viên mãn gặp Như Lai.",
        "url": [""],
        "dur": "32:17",
        "img": "apN1mUyMZg8"
      },
      {
        "stt": 99,
        "tit": "Tám mươi mốt nạn yêu ma hết - Vẹn tròn công quả đạo về nguồn.",
        "url": [""],
        "dur": "24:02",
        "img": "ab7nnz3tgKw"
      },
      {
        "stt": 100,
        "tit": "Về thẳng phương Đông - Năm Thánh thành Phật.",
        "url": [""],
        "dur": "30:08",
        "img": "69-RT5ofnDo"
      }
    ]
  }
]};
  
const lotrData = {
"meta" : {
	"name" : "Chúa tể những chiếc Nhẫn",
	"eName" : "The Lord of the Rings",
	"bookGrp" : [
		[ {"label": "The Lord of the Rings", "gId": "$6"} ],
		[ {"label": "Chúa tể những chiếc Nhẫn", "gId": "LOTR.RIN"} ],
		[ {"label": "Chúa tể những chiếc Nhẫn", "gId": "LOTR.RIN"} ]
	]
},
"books": [
  {
    "title": "Anh chàng Hobbit",
    "eTitle": "The Hobbit: Or There and Back Again",
    "author": "J. R. R. Tolkien",
    "type": "Đại kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://upload.wikimedia.org/wikipedia/vi/0/0f/Anh_chàng_Hobbit_(sách).jpg",
    "ssrc": [
      "https://radiotruyen.info/sach-noi/anh-chang-hobbit-snv.html",
      "https://archive.org/details/the-hobbit-17",
      "https://sachnoiviet.net/sach-noi/anh-chang-hobbit",
      "https://archive.org/details/truyendocviet.com_-_anh-chang-hobbit",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aiq4kPQ5zw2tCvj07l1E5360",
      "https://archive.org/details/TheHobbitAudiobook/The+Hobbit/Chapter+01+-+An+Unexpected+Party.mp3"
    ],
    "grp": ["LOTR.TAP0$6", "LOTR.RIN", "LOTR.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/the-hobbit-17/the-hobbit-<*~~*>.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/truyendocviet.com_-_anh-chang-hobbit/truyendocviet.com_-_anh-chang-hobbit-phan-<*~~*>_audio.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aiq4kPQ5zw2tCvj07l1E5360"
    },
    "year": 1937,
    "intro": "<b>Anh chàng Hobbit - Đến rồi quay trở lại</b> (tiếng Anh: The Hobbit, or There and back again) là một tiểu thuyết hư cấu dành cho thiếu nhi của nhà văn J. R. R. Tolkien, xuất bản ngày 21 tháng 9 năm 1937. Bản biên tập lần thứ hai của cuốn này được thực hiện vào năm 1951 ghi dấu những sửa đổi và đóng góp đáng kể trong Chương V, “Trò chơi đố trong hang tối”, giúp Anh chàng Hobbit ăn nhập hơn với cuốn tiểu thuyết tiếp theo Chúa nhẫn đang được viết lúc bấy giờ.<br/>Truyện lấy bối cảnh ở Trung địa (Middle-earth) - vũ trụ hư cấu của Tolkien - và kể về cuộc hành trình của anh chàng Hobbit tên Bilbo Baggins để giành lại kho báu của người lùn do rồng Smaug canh giữ. Truyện được chia thành 19 chương - qua mỗi chương, nhân vật Bilbo đạt được một cấp độ mới về sự trưởng thành, năng lực và trí tuệ. Câu chuyện đạt đến cao trào với Trận chiến 5 đạo quân, với sự tham gia của nhiều nhân vật và sinh vật từ các chương trước.<br/>Tác phẩm từng được đề cử Huân chương Carnegie và giành giải Tiểu thuyết cho thanh thiếu niên hay nhất của tờ New York Herald Tribune. Cuốn sách được dịch ra hơn 40 thứ tiếng. Cho đến thời điểm này, Nhà xuất bản Houghton Mifflin (Mỹ) đã tái bản ít nhất 60 lần ấn bản bìa cứng tuyệt đẹp do Alan Lee minh họa. Anh chàng Hobbit đã được chuyển thể thành loạt phim cùng tên.<br/>Chính Anh chàng hobbit đã đặt nền móng cho sự phát triển của dòng tiểu thuyết kỳ ảo hiện đại trong thế kỷ XX, không phải Chúa nhẫn như mọi người vẫn nghĩ.",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1: Bữa tiệc không mong đợi (Phần 1)",
        "url": ["", ""],
        "dur": "29:19",
        "img": "XuLHMD-008U",
        "eTit": "Chapter 1: An Unexpected Party"
      },
      {
        "stt": 2,
        "tit": "Chương 1: Bữa tiệc không mong đợi (Phần 2)",
        "url": ["", ""],
        "dur": "32:08",
        "img": "yZphmr-yMt8",
        "eTit": "Chapter 1: An Unexpected Party"
      },
      {
        "stt": 3,
        "tit": "Chương 2: Thịt cừu nướng (Phần 1)",
        "url": ["", ""],
        "dur": "24:17",
        "img": "5aA0Nwx2-Wo",
        "eTit": "Chapter 2: Roast Mutton"
      },
      {
        "stt": 4,
        "tit": "Chương 2: Thịt cừu nướng (Phần 2)",
        "url": ["", ""],
        "dur": "16:33",
        "img": "FprlBC_lkqw",
        "eTit": "Chapter 2: Roast Mutton"
      },
      {
        "stt": 5,
        "tit": "Chương 3: Cuộc nghỉ ngơi ngắn",
        "url": ["", ""],
        "dur": "22:21",
        "img": "TwIQoOxdisA",
        "eTit": "Chapter 3: A Short Rest"
      },
      {
        "stt": 6,
        "tit": "Chương 4: Phía trên ngọn đồi và phía dưới ngọn đồi",
        "url": ["", ""],
        "dur": "29:29",
        "img": "N7ZUnXZ3l7s",
        "eTit": "Chapter 4: Over Hill & Under Hill"
      },
      {
        "stt": 7,
        "tit": "Chương 5: Những câu đó trong bóng tối (Phần 1)",
        "url": ["", ""],
        "dur": "28:00",
        "img": "Toql-Vc2als",
        "eTit": "Chapter 5: Riddles in the Dark"
      },
      {
        "stt": 8,
        "tit": "Chương 5: Những câu đó trong bóng tối (Phần 2)",
        "url": ["", ""],
        "dur": "26:09",
        "img": "oegiUgt2Csg",
        "eTit": "Chapter 5: Riddles in the Dark"
      },
      {
        "stt": 9,
        "tit": "Chương 6: Tránh vỏ dưa gặp vỏ dừa (Phần 1)",
        "url": ["", ""],
        "dur": "22:36",
        "img": "DiJZc_FaDjk",
        "eTit": "Chapter 6: Out of the Frying Pan, Into the Fire"
      },
      {
        "stt": 10,
        "tit": "Chương 6: Tránh vỏ dưa gặp vỏ dừa (Phần 2)",
        "url": ["", ""],
        "dur": "24:56",
        "img": "V49vrGWzEi4",
        "eTit": "Chapter 6: Out of the Frying Pan, Into the Fire"
      },
      {
        "stt": 11,
        "tit": "Chương 7: Những chỗ trọ bình yên (Phần 1)",
        "url": ["", ""],
        "dur": "20:18",
        "img": "Ir3DcuSA9-Y",
        "eTit": "Chapter 7: Queer Lodgings"
      },
      {
        "stt": 12,
        "tit": "Chương 7: Những chỗ trọ bình yên (Phần 2)",
        "url": ["", ""],
        "dur": "20:18",
        "img": "5NZhzg7LKC0",
        "eTit": "Chapter 7: Queer Lodgings"
      },
      {
        "stt": 13,
        "tit": "Chương 7: Những chỗ trọ bình yên (Phần 3)",
        "url": ["", ""],
        "dur": "23:36",
        "img": "kMZHFI2ek4w",
        "eTit": "Chapter 7: Queer Lodgings"
      },
      {
        "stt": 14,
        "tit": "Chương 8: Ruồi và nhện (Phần 1)",
        "url": ["", ""],
        "dur": "25:15",
        "img": "uc6aggxR59g",
        "eTit": "Chapter 8: Flies & Spiders"
      },
      {
        "stt": 15,
        "tit": "Chương 8: Ruồi và nhện (Phần 2)",
        "url": ["", ""],
        "dur": "22:12",
        "img": "REWmXll3xkE",
        "eTit": "Chapter 8: Flies & Spiders"
      },
      {
        "stt": 16,
        "tit": "Chương 8: Ruồi và nhện (Phần 3)",
        "url": ["", ""],
        "dur": "25:49",
        "img": "BktHX6cGchI",
        "eTit": "Chapter 8: Flies & Spiders"
      },
      {
        "stt": 17,
        "tit": "Chương 9: Những thùng rượu sứt quai",
        "url": ["", ""],
        "dur": "41:26",
        "img": "lW1R8DMNv4g",
        "eTit": "Chapter 9: Barrels Out of Bond"
      },
      {
        "stt": 18,
        "tit": "Chương 10: Sự chào đón nồng ấm",
        "url": ["", ""],
        "dur": "30:16",
        "img": "YQsmmplJ3SY",
        "eTit": "Chapter 10: A Warm Welcome"
      },
      {
        "stt": 19,
        "tit": "Chương 11: Tại ngưỡng cửa",
        "url": ["", ""],
        "dur": "22:16",
        "img": "XzPbVHwkLEs",
        "eTit": "Chapter 11: On the Doorstep"
      },
      {
        "stt": 20,
        "tit": "Chương 12: Thông tin bên trong (Phần 1)",
        "url": ["", ""],
        "dur": "27:33",
        "img": "A1DSePy3slY",
        "eTit": "Chapter 12: Inside Information"
      },
      {
        "stt": 21,
        "tit": "Chương 12: Thông tin bên trong (Phần 2)",
        "url": ["", ""],
        "dur": "28:54",
        "img": "JWEYT1iYrlU",
        "eTit": "Chapter 12: Inside Information"
      },
      {
        "stt": 22,
        "tit": "Chương 13: Không phải ở nhà",
        "url": ["", ""],
        "dur": "29:52",
        "img": "AeT9IukYBVo",
        "eTit": "Chapter 13: Not at Home"
      },
      {
        "stt": 23,
        "tit": "Chương 14: Nước và lửa",
        "url": ["", ""],
        "dur": "24:11",
        "img": "0UdTPNebWrI",
        "eTit": "Chapter 14: Fire and Water"
      },
      {
        "stt": 24,
        "tit": "Chương 15: Sự hội tụ của những đám mây",
        "url": ["", ""],
        "dur": "26:31",
        "img": "7yEf0cGOiNg",
        "eTit": "Chapter 15: The Gathering of the Clouds"
      },
      {
        "stt": 25,
        "tit": "Chương 16: Tên trộm trong bóng đêm",
        "url": ["", ""],
        "dur": "17:15",
        "img": "rSpcgIPSH6s",
        "eTit": "Chapter 16: A Thief in the Night"
      },
      {
        "stt": 26,
        "tit": "Chương 17: Những đám mây nổ tan",
        "url": ["", ""],
        "dur": "29:34",
        "img": "UbFR7es51kA",
        "eTit": "Chapter 17: The Clouds Burst"
      },
      {
        "stt": 27,
        "tit": "Chương 18: Cuộc hành trình trở về",
        "url": ["", ""],
        "dur": "24:29",
        "img": "T9QMKt7dKLU",
        "eTit": "Chapter 18: The Return Journey"
      },
      {
        "stt": 28,
        "tit": "Chương 19: Chặng cuối",
        "url": [
          "",
          "https://archive.org/download/truyendocviet.com_-_anh-chang-hobbit/truyendocviet.com_-_anh-chang-hobbit-phan-28-het_audio.mp3"
        ],
        "dur": "20:12",
        "img": "oah_u9ePd10",
        "eTit": "Chapter 19: The Last Stage"
      }
    ]
  },
  {
    "title": "Chúa tể những chiếc nhẫn I: Đoàn hộ Nhẫn",
    "eTitle": "The Lord of the Rings - Volume I: The Fellowship of the Ring",
    "author": "J. R. R. Tolkien",
    "type": "Đại kỳ ảo",
    "mc": "Mạnh Tuấn",
    "cover": "https://www.dtv-ebook.com/images/truyen-online/ebook-doan-ho-nhan-prc-pdf-epub.jpg",
    "ssrc": [
      "https://archive.org/details/chua-te-nhung-chiec-nhan-phan-12-2"      ,
      "https://youtube.com/playlist?list=PL0glwZLj5l18FQ70rF3ct1MhaCLOhQKU9"
    ],
    "grp": ["LOTR.TAP1$6", "LOTR.RIN", "LOTR.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/chua-te-nhung-chiec-nhan-phan-12-2/Chua Te Nhung Chiec Nhan - Phan <*~~*>.mp3"
        }
      ],
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL0glwZLj5l18FQ70rF3ct1MhaCLOhQKU9"
    },
    "year": 1954,
    "tap": [
      {"label": "QUYỂN MỘT - BOOK ONE", "f":  1, "t": 12},
      {"label": "QUYỂN HAI - BOOK TWO", "f": 13, "t": 22}
    ],
    "intro": "<b>Chúa tể những chiếc nhẫn</b> được viết trong thời kỳ tác giả dạy học ở Oxford, từ năm 1937 đến 1949; nhưng những phác thảo đầu tiên về Arda đã bắt đầu từ 1917, khi ông đang dưỡng thương trong quá trình tham chiến ở Pháp. Buổi sáng thế từ Âm nhạc của các Ainur, những cuộc di cư lớn của người Tiên, chuyện tình giữa Beren và Lúthien, trận chiến quy mô vũ trụ giữa các Valar cùng người Tiên với Morgoth mà Sauron chỉ là một gã học trò, tất cả đã thành hình từ lâu trước khi lần đầu tiên ông nghĩ tới giống dân Hobbit. Và câu chuyện về cuộc Nhẫn Chiến trở thành một nối tiếp tự nhiên, Kỷ Đệ Tam, theo sau những thời đại hoàng kim kia. Tolkien mong muốn tạo ra một sử thi không kém Beowulf hoặc Kalevala, nhưng những gì ông làm được có lẽ còn rộng hơn thế.<br/>Một trong những điểm hấp dẫn chính của Chúa tể những chiếc Nhẫn lại không nằm trong những trang sách: mà là trong sự tồn tại của câu chuyện với tư cách một mảnh ghép làm thành “hệ truyền thuyết” (legendarium - chữ của Tolkien) về Trung Địa; nói cách khác, trong sự tồn tại của Trung Địa như một lục địa bên trong Arda (thế giới này), đến lượt nó lại nằm trong Eä (vũ trụ)",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1: Một bữa tiệc từ lâu trông đợi",
        "url": [""],
        "dur": "1:24:52",
        "eTit": "Chapter 1: A Long-expected Party",
        "oUrl": "kP2bPNQ8Q6M"
      },
      {
        "stt": 2,
        "tit": "Chương 2: Bóng ma từ quá khứ",
        "url": [""],
        "dur": "1:30:14",
        "eTit": "Chapter 2: The Shadow of the Past",
        "oUrl": "xr44PW_G-_c"
      },
      {
        "stt": 3,
        "tit": "Chương 3: Ba người là đủ đoàn",
        "url": [""],
        "dur": "1:14:30",
        "eTit": "Chapter 3: Three is Company",
        "oUrl": "OXpDDP5k8lw"
      },
      {
        "stt": 4,
        "tit": "Chương 4: Đường tắt tới tìm nấm",
        "url": [""],
        "dur": "44:46",
        "eTit": "Chapter 4: A Short Cut to Mushroom",
        "oUrl": "MNNwt7acFo4"
      },
      {
        "stt": 5,
        "tit": "Chương 5: Âm mưu bị vạch trần",
        "url": [""],
        "dur": "39:03",
        "eTit": "Chapter 5: A Conspiracy Unmasked",
        "oUrl": "a45NF4nobb8"
      },
      {
        "stt": 6,
        "tit": "Chương 6: Rừng già",
        "url": [""],
        "dur": "47:49",
        "eTit": "Chapter 6: The Old Forest",
        "oUrl": "fptc-7Qjn7g"
      },
      {
        "stt": 7,
        "tit": "Chương 7: Trong nhà của Tom Bombadil",
        "url": [""],
        "dur": "41:50",
        "eTit": "Chapter 7: In the House of Tom Bombadil",
        "oUrl": "ig_J5c5gE8A"
      },
      {
        "stt": 8,
        "tit": "Chương 8: Sương trên vệt đồi mộ đá",
        "url": [""],
        "dur": "50:30",
        "eTit": "Chapter 8: Fog on the Barrow-downs",
        "oUrl": "_rZuPCVjuK4"
      },
      {
        "stt": 9,
        "tit": "Chương 9: Dưới tấm biển quán ngựa lồng",
        "url": [""],
        "dur": "45:25",
        "eTit": "Chapter 9: At the Sign of the Prancing Pony",
        "oUrl": "cUq8t3uk2eo"
      },
      {
        "stt": 10,
        "tit": "Chương 10: Sải chân dài",
        "url": [""],
        "dur": "46:32",
        "eTit": "Chapter 10: Strider",
        "oUrl": "UtIaOa_tXZU"
      },
      {
        "stt": 11,
        "tit": "Chương 11: Con dao trong bóng tối",
        "url": [""],
        "dur": "1:13:07",
        "eTit": "Chapter 11: A Knife in the Dark",
        "oUrl": "p7-yPnyYOf8"
      },
      {
        "stt": 12,
        "tit": "Chương 12: Phi như bay đến khúc cạn",
        "url": [
          "https://archive.org/download/chua-te-nhung-chiec-nhan-phan-12-2/Chua Te Nhung Chiec Nhan - Phan 12-.mp3",
          "https://archive.org/download/chua-te-nhung-chiec-nhan-phan-12-2/Chua Te Nhung Chiec Nhan - Phan 12-2.mp3"
        ],
        "dur": "1:03:48",
        "eTit": "Chapter 12: Flight to the Ford",
        "oUrl": "CbLDCtR6WkM"
      },
      {
        "stt": 13,
        "tit": "Chương 1: Rất nhiều cuộc gặp gỡ",
        "url": [""],
        "dur": "1:04:23",
        "eTit": "Chapter 1: Many Meetings",
        "oUrl": "E5Kum-WK1sg"
      },
      {
        "stt": 14,
        "tit": "Chương 2: Hội đồng của Elrond",
        "url": [""],
        "dur": "2:09:41",
        "eTit": "Chapter 2: The Council of Elrond",
        "oUrl": "falv2RcjBKo"
      },
      {
        "stt": 15,
        "tit": "Chương 3: Chiếc nhẫn đi về phương Nam",
        "url": [""],
        "dur": "1:21:17",
        "eTit": "Chapter 3: The Ring Goes South",
        "oUrl": "NPBG9sN3I7M"
      },
      {
        "stt": 16,
        "tit": "Chương 4: Hành trình trong bóng tối",
        "url": [""],
        "dur": "1:26:53",
        "eTit": "Chapter 4: A Journey in the Dark",
        "oUrl": "m2rPMGiKEDQ"
      },
      {
        "stt": 17,
        "tit": "Chương 5: Cây cầu cổng Khazad-Dûm",
        "url": [""],
        "dur": "43:20",
        "eTit": "Chapter 5: The Bridge of Khazad-dûm",
        "oUrl": "Z78YC21F1dQ"
      },
      {
        "stt": 18,
        "tit": "Chương 6: Lóthlorien",
        "url": [""],
        "dur": "1:11:07",
        "eTit": "Chapter 6: Lóthlorien",
        "oUrl": "wyQf1XFD8b4"
      },
      {
        "stt": 19,
        "tit": "Chương 7: Mặt gương của Galadriel",
        "url": [""],
        "dur": "50:37",
        "eTit": "Chapter 7: The Mirror of Galadriel",
        "oUrl": "L6vTgjUBzNw"
      },
      {
        "stt": 20,
        "tit": "Chương 8: Vĩnh biệt Lórien",
        "url": [""],
        "dur": "42:02",
        "eTit": "Chapter 8: Farewell to Lórien",
        "oUrl": "8xI1zyp5MH8"
      },
      {
        "stt": 21,
        "tit": "Chương 9: Sông cả",
        "url": [""],
        "dur": "52:00",
        "eTit": "Chapter 9: The great river",
        "oUrl": "J-Qrz3QXC4k"
      },
      {
        "stt": 22,
        "tit": "Chương 10: Đoàn hộ nhẫn tan vỡ",
        "url": [
          "https://archive.org/download/chua-te-nhung-chiec-nhan/23.mp3"
        ],
        "dur": "41:23",
        "eTit": "Chapter 10: The Breaking of the Fellowship",
        "oUrl": "J5r0LeIukKs"
      }
    ]
  },
  {
    "title": "Chúa tể những chiếc nhẫn I: Đoàn hộ Nhẫn",
    "eTitle": "The Lord of the Rings - Volume I: The Fellowship of the Ring",
    "author": "J. R. R. Tolkien",
    "type": "Đại kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.dtv-ebook.com/images/truyen-online/ebook-doan-ho-nhan-prc-pdf-epub.jpg",
    "ssrc": [
      "https://nghetruyen.org/chi-tiet/chua-te-nhung-chiec-nhan-8022.html",
      "https://archive.org/details/chua-te-nhung-chiec-nhan",
      "https://archive.org/details/chua-te-nhung-chiec-nhan-phan-12-2",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aipwRW8eqAaxVOMQ_XBkBaxb"
    ],
    "grp": ["LOTR.TAP1$6", "LOTR.RIN", "LOTR.RIN"],
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/chua-te-nhung-chiec-nhan/<*~~*>.mp3"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aipwRW8eqAaxVOMQ_XBkBaxb"
    },
    "year": 1954,
    "tap": [
      {"label": "QUYỂN MỘT - BOOK ONE", "f":  1, "t": 12},
      {"label": "QUYỂN HAI - BOOK TWO", "f": 13, "t": 23}
    ],
    "intro": "<b>Chúa tể những chiếc nhẫn</b> được viết trong thời kỳ tác giả dạy học ở Oxford, từ năm 1937 đến 1949; nhưng những phác thảo đầu tiên về Arda đã bắt đầu từ 1917, khi ông đang dưỡng thương trong quá trình tham chiến ở Pháp. Buổi sáng thế từ Âm nhạc của các Ainur, những cuộc di cư lớn của người Tiên, chuyện tình giữa Beren và Lúthien, trận chiến quy mô vũ trụ giữa các Valar cùng người Tiên với Morgoth mà Sauron chỉ là một gã học trò, tất cả đã thành hình từ lâu trước khi lần đầu tiên ông nghĩ tới giống dân Hobbit. Và câu chuyện về cuộc Nhẫn Chiến trở thành một nối tiếp tự nhiên, Kỷ Đệ Tam, theo sau những thời đại hoàng kim kia. Tolkien mong muốn tạo ra một sử thi không kém Beowulf hoặc Kalevala, nhưng những gì ông làm được có lẽ còn rộng hơn thế.<br/>Một trong những điểm hấp dẫn chính của Chúa tể những chiếc Nhẫn lại không nằm trong những trang sách: mà là trong sự tồn tại của câu chuyện với tư cách một mảnh ghép làm thành “hệ truyền thuyết” (legendarium - chữ của Tolkien) về Trung Địa; nói cách khác, trong sự tồn tại của Trung Địa như một lục địa bên trong Arda (thế giới này), đến lượt nó lại nằm trong Eä (vũ trụ)",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1: Một bữa tiệc từ lâu trông đợi (Phần 1)",
        "url": ["1"],
        "dur": "25:12",
        "img": "KJwHo_acmuM",
        "eTit": "Chapter 1: A Long-expected Party"
      },
      {
        "stt": 2,
        "tit": "Chương 1: Một bữa tiệc từ lâu trông đợi (Phần 2)",
        "url": ["2"],
        "dur": "25:17",
        "img": "eQ70qCsZYQM",
        "eTit": "Chapter 1: A Long-expected Party"
      },
      {
        "stt": 3,
        "tit": "Chương 1: Một bữa tiệc từ lâu trông đợi (Phần 3)",
        "url": ["3"],
        "dur": "23:31",
        "img": "PBykX7TUwc8",
        "eTit": "Chapter 1: A Long-expected Party"
      },
      {
        "stt": 4,
        "tit": "Chương 2: Bóng ma từ quá khứ (Phần 1)",
        "url": ["4"],
        "dur": "30:06",
        "img": "KP6U62CmMAM",
        "eTit": "Chapter 2: The Shadow of the Past"
      },
      {
        "stt": 5,
        "tit": "Chương 2: Bóng ma từ quá khứ (Phần 2)",
        "url": ["5"],
        "dur": "29:00",
        "img": "6WUS3izIZnc",
        "eTit": "Chapter 2: The Shadow of the Past"
      },
      {
        "stt": 6,
        "tit": "Chương 2: Bóng ma từ quá khứ (Phần 3)",
        "url": ["6"],
        "dur": "34:11",
        "img": "9ahEOsrol94",
        "eTit": "Chapter 2: The Shadow of the Past"
      },
      {
        "stt": 7,
        "tit": "Chương 3: Ba người là đủ đoàn",
        "url": ["7"],
        "dur": "1:15:30",
        "img": "aUm0MiD98Zk",
        "eTit": "Chapter 3: Three is Company"
      },
      {
        "stt": 8,
        "tit": "Chương 4: Đường tắt tới tìm nấm - Chương 5: Âm mưu bị vạch trần",
        "url": ["8"],
        "dur": "1:22:06",
        "img": "2GttSloDhLY",
        "eTit": "Chapter 4: A Short Cut to Mushroom; Chapter 5: A Conspiracy Unmasked"
      },
      {
        "stt": 9,
        "tit": "Chương 6: Rừng già - Chương 7: Trong nhà Tom Bombadil",
        "url": ["9"],
        "dur": "1:31:44",
        "img": "UB1YJq4WrS0",
        "eTit": "Chapter 6: The Old Forest; Chapter 7: In the House of Tom Bombadil"
      },
      {
        "stt": 10,
        "tit": "Chương 8: Sương trên vệt đồi mộ đá - Chương 9: Dưới tấm biển quán ngựa lồng",
        "url": [
          "10"
        ],
        "dur": "1:32:41",
        "img": "iV6Lst8wJ14",
        "eTit": "Chapter 8: Fog on the Barrow-downs; Chapter 9: At the Sign of the Prancing Pony"
      },
      {
        "stt": 11,
        "tit": "Chương 10: Sải chân dài - Chương 11: Con dao trong bóng tối",
        "url": [
          "11"
        ],
        "dur": "1:43:49",
        "img": "lmx2ChxHkvg",
        "eTit": "Chapter 10: Strider; Chapter 11: A Knife in the Dark"
      },
      {
        "stt": 12,
        "tit": "Chương 12: Phi như bay đến khúc cạn",
        "url": [
          "12"
        ],
        "dur": "57:16",
        "img": "tSpmXI4h6xQ",
        "eTit": "Chapter 12: Flight to the Ford"
      },
      {
        "stt": 13,
        "tit": "Chương 1: Rất nhiều cuộc gặp gỡ",
        "url": [
          "13"
        ],
        "dur": "56:47",
        "img": "wKCcfENY80o",
        "eTit": "Chapter 1: Many Meetings"
      },
      {
        "stt": 14,
        "tit": "Chương 2: Hội đồng của Elrond (Phần 1)",
        "url": [
          "14"
        ],
        "dur": "55:54",
        "img": "_q54Mwa-PiA",
        "eTit": "Chapter 2: The Council of Elrond"
      },
      {
        "stt": 15,
        "tit": "Chương 2: Hội đồng của Elrond (Phần 2)",
        "url": [
          "15"
        ],
        "dur": "52:37",
        "img": "I_EHEbK7M5E",
        "eTit": "Chapter 2: The Council of Elrond"
      },
      {
        "stt": 16,
        "tit": "Chương 3: Chiếc nhẫn lên đường nam tiến",
        "url": [
          "16"
        ],
        "dur": "54:34",
        "img": "T7PHX7GuXTs",
        "eTit": "Chapter 3: The Ring Goes South"
      },
      {
        "stt": 17,
        "tit": "Chương 4: Hành trình trong bóng tối",
        "url": [
          "17"
        ],
        "dur": "46:54",
        "img": "z4pkayU83LQ",
        "eTit": "Chapter 4: A Journey in the Dark"
      },
      {
        "stt": 18,
        "tit": "Chương 5: Cây cầu cổng Khazad-Dûm",
        "url": [
          "18"
        ],
        "dur": "1:01:23",
        "img": "3sNmfjsuXy4",
        "eTit": "Chapter 5: The Bridge of Khazad-dûm"
      },
      {
        "stt": 19,
        "tit": "Chương 6: Lothlórien",
        "url": [
          "19"
        ],
        "dur": "1:01:18",
        "img": "53eaHJiGLkA",
        "eTit": "Chapter 6: Lóthlorien"
      },
      {
        "stt": 20,
        "tit": "Chương 7: Mặt gương của Galadriel",
        "url": [
          "20"
        ],
        "dur": "46:59",
        "img": "Tf-TqcClkpk",
        "eTit": "Chapter 7: The mirror of Galadriel"
      },
      {
        "stt": 21,
        "tit": "Chương 8: Vĩnh biệt Lórien",
        "url": [
          "21"
        ],
        "dur": "42:21",
        "img": "t-HJsGfVyeY",
        "eTit": "Chapter 8: Farewell to Lórien"
      },
      {
        "stt": 22,
        "tit": "Chương 9: Sông cả",
        "url": [
          "22"
        ],
        "dur": "46:22",
        "img": "OsNLFTbezRY",
        "eTit": "Chapter 9: The great river"
      },
      {
        "stt": 23,
        "tit": "Chương 10: Đoàn hộ nhẫn tan vỡ",
        "url": [
          "23"
        ],
        "dur": "41:23",
        "img": "l8hDxeWGdyc",
        "eTit": "Chapter 10: he Breaking of the Fellowship"
      }
    ]
  },
  {
    "title": "Chúa tể những chiếc nhẫn II: Hai tòa Tháp",
    "eTitle": "The Lord of the Rings - Volume II: The Two Towers",
    "author": "J. R. R. Tolkien",
    "type": "Đại kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.dtv-ebook.com/images/truyen-online/ebook-chua-te-cua-nhung-chiec-nhan-tap-2-prc-pdf-epub.jpg",
    "ssrc": [
      "https://nghetruyen.org/chi-tiet/chua-te-nhung-chiec-nhan-8022.html",
      "https://archive.org/details/chua-te-nhung-chiec-nhan",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aioL0rPldxJjaphI4FmNB8R0"
    ],
    "grp": ["LOTR.TAP2$6", "LOTR.RIN", "LOTR.RIN"],
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/chua-te-nhung-chiec-nhan/<*~~*>.mp3"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aioL0rPldxJjaphI4FmNB8R0"
    },
    "year": 1954,
    "tap": [
      {"label": "QUYỂN BA - BOOK THREE", "f":  1, "t": 11},
      {"label": "QUYỂN BỐN - BOOK FOUR", "f": 12, "t": 21}
    ],
    "intro": "<b>Chúa tể những chiếc nhẫn</b> được viết trong thời kỳ tác giả dạy học ở Oxford, từ năm 1937 đến 1949; nhưng những phác thảo đầu tiên về Arda đã bắt đầu từ 1917, khi ông đang dưỡng thương trong quá trình tham chiến ở Pháp. Buổi sáng thế từ Âm nhạc của các Ainur, những cuộc di cư lớn của người Tiên, chuyện tình giữa Beren và Lúthien, trận chiến quy mô vũ trụ giữa các Valar cùng người Tiên với Morgoth mà Sauron chỉ là một gã học trò, tất cả đã thành hình từ lâu trước khi lần đầu tiên ông nghĩ tới giống dân Hobbit. Và câu chuyện về cuộc Nhẫn Chiến trở thành một nối tiếp tự nhiên, Kỷ Đệ Tam, theo sau những thời đại hoàng kim kia. Tolkien mong muốn tạo ra một sử thi không kém Beowulf hoặc Kalevala, nhưng những gì ông làm được có lẽ còn rộng hơn thế.<br/>Một trong những điểm hấp dẫn chính của Chúa tể những chiếc Nhẫn lại không nằm trong những trang sách: mà là trong sự tồn tại của câu chuyện với tư cách một mảnh ghép làm thành “hệ truyền thuyết” (legendarium - chữ của Tolkien) về Trung Địa; nói cách khác, trong sự tồn tại của Trung Địa như một lục địa bên trong Arda (thế giới này), đến lượt nó lại nằm trong Eä (vũ trụ)",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1: Cái chết của Boromir",
        "url": [
          "24"
        ],
        "dur": "25:08",
        "img": "QHUjvR6pXr0",
        "eTit": "Chapter 1: The departure of Boromir"
      },
      {
        "stt": 2,
        "tit": "Chương 2: Những kỵ sĩ Rohan",
        "url": [
          "25"
        ],
        "dur": "1:18:01",
        "img": "Iwx_EN3Pq_k",
        "eTit": "Chapter 2: The Riders of Rohan"
      },
      {
        "stt": 3,
        "tit": "Chương 3: Đội quân Uruk-Hai",
        "url": [
          "26"
        ],
        "dur": "56:35",
        "img": "tdb-TDsUDcU",
        "eTit": "Chapter 3: The Uruk-Hai"
      },
      {
        "stt": 4,
        "tit": "Chương 4: Cây râu",
        "url": [
          "27"
        ],
        "dur": "1:39:13",
        "img": "RW0JYFJowCk",
        "eTit": "Chapter 4: Treebeard"
      },
      {
        "stt": 5,
        "tit": "Chương 5: Kỵ sĩ trắng",
        "url": [
          "28"
        ],
        "dur": "1:05:19",
        "img": "Mm9WiTzKriY",
        "eTit": "Chapter 5: The White rider"
      },
      {
        "stt": 6,
        "tit": "Chương 6: Nhà vua trong cung điện vàng",
        "url": [
          "29"
        ],
        "dur": "1:10:19",
        "img": "hKHakm9Y7js",
        "eTit": "Chapter 6: The King of the golden hall"
      },
      {
        "stt": 7,
        "tit": "Chương 7: Hẻm Helm",
        "url": [
          "30"
        ],
        "dur": "52:00",
        "img": "Ys5pDT0g0HU",
        "eTit": "Chapter 7: Helm’s deep"
      },
      {
        "stt": 8,
        "tit": "Chương 8: Đường đến Isengard",
        "url": [
          "31"
        ],
        "dur": "55:47",
        "img": "Ig3DjTuL0o4",
        "eTit": "Chapter 8: The road to Isengard"
      },
      {
        "stt": 9,
        "tit": "Chương 9: Những thứ trôi nổi",
        "url": [
          "32"
        ],
        "dur": "50:51",
        "img": "73beJMnUy74",
        "eTit": "Chapter 9: Flotsam and jetsam"
      },
      {
        "stt": 10,
        "tit": "Chương 10: Giọng nói của Saruman",
        "url": [
          "33"
        ],
        "dur": "43:41",
        "img": "0QL8Tt0BCYQ",
        "eTit": "Chapter 10: The voice of Saruman"
      },
      {
        "stt": 11,
        "tit": "Chương 11: Quả cầu Palantír",
        "url": [
          "34"
        ],
        "dur": "46:07",
        "img": "FZwN7GtHxXs",
        "eTit": "Chapter 11: The Palantír"
      },
      {
        "stt": 12,
        "tit": "Chương 1: Thuần phục Sméagol",
        "url": [
          "35"
        ],
        "dur": "56:48",
        "img": "z0fUISnnQ04",
        "eTit": "Chapter 1: The taming of Sméagol"
      },
      {
        "stt": 13,
        "tit": "Chương 2: Đường xuyên đầm lầy",
        "url": [
          "36"
        ],
        "dur": "51:16",
        "img": "q8BatQipnzs",
        "eTit": "Chapter 2: The passage of the marshes"
      },
      {
        "stt": 14,
        "tit": "Chương 3: Cổng đen đã đóng",
        "url": [
          "37"
        ],
        "dur": "51:16",
        "img": "Mh6JcJ2vLuU",
        "eTit": "Chapter 3: The Black gate is closed"
      },
      {
        "stt": 15,
        "tit": "Chương 4: Về rau thơm và thỏ hầm",
        "url": [
          "38"
        ],
        "dur": "49:35",
        "img": "4TXU0YeNkBA",
        "eTit": "Chapter 4: of herbs and stewed rabbit"
      },
      {
        "stt": 16,
        "tit": "Chương 5: Cửa sổ nhìn về tây",
        "url": [
          "39"
        ],
        "dur": "48:30",
        "img": "HWXcQq0evXk",
        "eTit": "Chapter 5: The window on the west"
      },
      {
        "stt": 17,
        "tit": "Chương 6: Ao cấm",
        "url": [
          "40"
        ],
        "dur": "1:04:01",
        "img": "PMaCTmIlIEE",
        "eTit": "Chapter 6: The forbidden pool"
      },
      {
        "stt": 18,
        "tit": "Chương 7: Hành trình đến ngã tư đường",
        "url": [
          "41"
        ],
        "dur": "32:21",
        "img": "3WcXWwvKOvM",
        "eTit": "Chapter 7: Journey to the cross-roads"
      },
      {
        "stt": 19,
        "tit": "Chương 8: Các cầu thang ở Cirith Ungol",
        "url": [
          "42"
        ],
        "dur": "50:55",
        "img": "LlTg2UdxHZM",
        "eTit": "Chapter 8: The stairs of Cirith Ungol"
      },
      {
        "stt": 20,
        "tit": "Chương 9: Động bà nhện",
        "url": [
          "43"
        ],
        "dur": "38:12",
        "img": "lW9We3Kwc8k",
        "eTit": "Chapter 9: Shelob’s lair"
      },
      {
        "stt": 21,
        "tit": "Chương 10: Lựa chọn của cậu Samwise",
        "url": [
          "44"
        ],
        "dur": "50:14",
        "img": "p4XF8pAQ8jE",
        "eTit": "Chapter 10: The choices of master Samwise"
      }
    ]
  },
  {
    "title": "Chúa tể những chiếc nhẫn III: Nhà Vua trở về",
    "eTitle": "The Lord of the Rings - Volume III: The Return of the King",
    "author": "J. R. R. Tolkien",
    "type": "Đại kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.dtv-ebook.com/images/truyen-online/ebook-chua-te-cua-nhung-chiec-nhan-tap-3-prc-pdf-epub.jpg",
    "ssrc": [
      "https://nghetruyen.org/chi-tiet/chua-te-nhung-chiec-nhan-8022.html",
      "https://archive.org/details/chua-te-nhung-chiec-nhan",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aioORSLPROSKyQYE_NH2Kxp3"
    ],
    "grp": ["LOTR.TAP3$6", "LOTR.RIN", "LOTR.RIN"],
    "year": 1955,
    "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://archive.org/download/chua-te-nhung-chiec-nhan/<*~~*>.mp3"
		  }
		],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aioORSLPROSKyQYE_NH2Kxp3"
    },
    "tap": [
      {"label": "QUYỂN NĂM - BOOK FIVE", "f":  1, "t": 10},
      {"label": "QUYỂN SÁU - BOOK SIX" , "f": 11, "t": 21}
    ],
    "intro": "<b>Chúa tể những chiếc nhẫn</b> được viết trong thời kỳ tác giả dạy học ở Oxford, từ năm 1937 đến 1949; nhưng những phác thảo đầu tiên về Arda đã bắt đầu từ 1917, khi ông đang dưỡng thương trong quá trình tham chiến ở Pháp. Buổi sáng thế từ Âm nhạc của các Ainur, những cuộc di cư lớn của người Tiên, chuyện tình giữa Beren và Lúthien, trận chiến quy mô vũ trụ giữa các Valar cùng người Tiên với Morgoth mà Sauron chỉ là một gã học trò, tất cả đã thành hình từ lâu trước khi lần đầu tiên ông nghĩ tới giống dân Hobbit. Và câu chuyện về cuộc Nhẫn Chiến trở thành một nối tiếp tự nhiên, Kỷ Đệ Tam, theo sau những thời đại hoàng kim kia. Tolkien mong muốn tạo ra một sử thi không kém Beowulf hoặc Kalevala, nhưng những gì ông làm được có lẽ còn rộng hơn thế.<br/>Một trong những điểm hấp dẫn chính của Chúa tể những chiếc Nhẫn lại không nằm trong những trang sách: mà là trong sự tồn tại của câu chuyện với tư cách một mảnh ghép làm thành “hệ truyền thuyết” (legendarium - chữ của Tolkien) về Trung Địa; nói cách khác, trong sự tồn tại của Trung Địa như một lục địa bên trong Arda (thế giới này), đến lượt nó lại nằm trong Eä (vũ trụ)",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1: Minas Tirith",
        "url": [
          "45"
        ],
        "dur": "1:06:48",
        "img": "S_5GBiZsVKc",
        "eTit": "Chapter 1: Minas Tirith"
      },
      {
        "stt": 2,
        "tit": "Chương 2: Đoàn áo xám kéo quân",
        "url": [
          "46"
        ],
        "dur": "1:22:14",
        "img": "kdIWCIavT7U",
        "eTit": "Chapter 2: The passing of the Grey company"
      },
      {
        "stt": 3,
        "tit": "Chương 3: Cuộc hội quân Rohan",
        "url": [
          "47"
        ],
        "dur": "50:08",
        "img": "U9n-4Vwn_YY",
        "eTit": "Chapter 3: The Muster of Rohan"
      },
      {
        "stt": 4,
        "tit": "Chương 4: Cuộc vây hãm Gondor",
        "url": [
          "48"
        ],
        "dur": "1:28:01",
        "img": "mFBmEwP3qVM",
        "eTit": "Chapter 4: The siege of Gondor"
      },
      {
        "stt": 5,
        "tit": "Chương 5: Chuyến hành quân của người Rohirrim",
        "url": [
          "49"
        ],
        "dur": "31:41",
        "img": "r5IjyNdc0y4",
        "eTit": "Chapter 5: The ride of the Rohirrim"
      },
      {
        "stt": 6,
        "tit": "Chương 6: Trận chiến trên đồng Pelennor",
        "url": [
          "50"
        ],
        "dur": "38:15",
        "img": "RlUSpJT6l0Q",
        "eTit": "Chapter 6: The battle of the Pelennor fields"
      },
      {
        "stt": 7,
        "tit": "Chương 7: Giàn thiêu của Denethor",
        "url": [
          "51"
        ],
        "dur": "26:19",
        "img": "FR4EinxuoLo",
        "eTit": "Chapter 7: The pyre of Denethor"
      },
      {
        "stt": 8,
        "tit": "Chương 8: Y viện",
        "url": [
          "52"
        ],
        "dur": "47:29",
        "img": "FmRMGP-DcWc",
        "eTit": "Chapter 8: The houses of healing"
      },
      {
        "stt": 9,
        "tit": "Chương 9: Cuộc thảo luận cuối cùng",
        "url": [
          "53"
        ],
        "dur": "37:24",
        "img": "JarzHY9tlaY",
        "eTit": "Chapter 9: The last debate"
      },
      {
        "stt": 10,
        "tit": "Chương 10: Cổng đen đã mở",
        "url": [
          "54"
        ],
        "dur": "35:51",
        "img": "Xqa4AATq9uQ",
        "eTit": "Chapter 10: The Black gate opens"
      },
      {
        "stt": 11,
        "tit": "Chương 1: Tháp Cirith Ungol",
        "url": [
          "55"
        ],
        "dur": "1:06:51",
        "img": "GoCngNX6gkg",
        "eTit": "Chapter 1: The tower of Cirith Ungol"
      },
      {
        "stt": 12,
        "tit": "Chương 2: Vùng đất bóng tối",
        "url": [
          "56"
        ],
        "dur": "57:51",
        "img": "VKZz1vczDkU",
        "eTit": "Chapter 2: The land of shadow"
      },
      {
        "stt": 13,
        "tit": "Chương 3: Đỉnh định mệnh",
        "url": [
          "57"
        ],
        "dur": "54:58",
        "img": "cGNoboef2xM",
        "eTit": "Chapter 3: Mount doom"
      },
      {
        "stt": 14,
        "tit": "Chương 4: Đồng Cormallen",
        "url": [
          "58"
        ],
        "dur": "35:17",
        "img": "m9fnehNoPj4",
        "eTit": "Chapter 4: The field of Cormallen"
      },
      {
        "stt": 15,
        "tit": "Chương 5: Quốc quản và nhà vua",
        "url": [
          "59"
        ],
        "dur": "52:55",
        "img": "MWBP0gRsiRw",
        "eTit": "Chapter 5: The steward and the king"
      },
      {
        "stt": 16,
        "tit": "Chương 6: Rất nhiều cuộc chia tay",
        "url": [
          "60"
        ],
        "dur": "55:00",
        "img": "4sTQJ-oAMqI",
        "eTit": "Chapter 6: Many partings"
      },
      {
        "stt": 17,
        "tit": "Chương 7: Đường về nhà",
        "url": [
          "61"
        ],
        "dur": "28:08",
        "img": "C6AXK9j70ww",
        "eTit": "Chapter 7: Homeward bound"
      },
      {
        "stt": 18,
        "tit": "Chương 8: Cuộc thanh tẩy quận",
        "url": [
          "62"
        ],
        "dur": "1:18:12",
        "img": "06M23hhv54c",
        "eTit": "Chapter 8: The scouring of the Shire"
      },
      {
        "stt": 19,
        "tit": "Chương 9: Cảng xám",
        "url": [
          "63"
        ],
        "dur": "31:41",
        "img": "nXj-DcLdDMw",
        "eTit": "Chapter 9: The Grey havens"
      }
    ]
  }
]};

const witcherData = {
"meta" : {
	"name" : "Thợ săn quái vật",
	"eName" : "The Witcher",
	"bookGrp" : [
		[ {"label": "The Witcher - Tuyển tập truyện ngắn" , "gId": "$7"},
		  {"label": "The Witcher - Saga" , "gId": "$8"}],
		[ {"label": "Thợ săn quái vật - Truyện ngắn", "gId": "WTCH.RIN-TN"},
		  {"label": "Thợ săn quái vật - Saga", "gId": "WTCH.RIN-TT"} ],
		[ {"label": "Thợ săn quái vật", "gId": "WTCH.RIN"} ]
	]
},
"books": [
  {
    "title": "The Witcher - Ước nguyện cuối cùng",
    "eTitle": "The Last Wish - Ostatnie życzenie",
    "author": "Andrzej Sapkowski",
    "type": "Kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.nae.vn/ttv/ttv/public/images/story/10d6e6c1205bc9ca951967426546edf2961771d358a2aed38ce62195dca45605.jpg",
    "ssrc": [
      "https://radiotruyen.info/sach-noi/the-last-wish-the-witcher-series-snv.html",
      "https://archive.org/details/uoc-nguyen-08",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aioZw3DxGTzajiYx3ZQd8Ve2"
    ],
    "grp": ["WTCH.TAP1$7", "WTCH.RIN-TN", "WTCH.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/uoc-nguyen-08/uoc-nguyen-<*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aioZw3DxGTzajiYx3ZQd8Ve2"
    },
    "year": 1993,
    "intro": "Nhân vật chính của câu truyện là Geralt xứ Rivia - một witcher, một sát thủ đột biến đã được huấn luyện từ nhỏ và trải qua những biến đổi thể chất để đạt được thể lực hơn người. Với nhiều người, gã là thợ săn tiền thưởng, là phù thủy, kẻ đột biến đáng khinh, quân sát nhân máu lạnh. Mặc dù vậy, mục đích của Geralt chỉ có một: tiêu diệt đám quái vật đang lan tràn khắp thế giới. Nhưng Geralt không sống trong một thế giới nơi các quan niệm đạo đức đều rạch ròi trắng đen, hay mọi thứ xấu xí đều xấu xa. Gã vẫn tuân theo những nguyên tắc của riêng mình, dẫu cho có lúc phải lựa chọn đâu là phương án ít tàn ác hơn.<br/>Vừa đa nghi vừa quân tử, Geralt được so sánh với nhân vật Philip Marlowe của nhà văn Raymond Chandler. Thế giới giả tưởng này có phần dựa theo nhà văn J.R.R. Tolkien, nhưng vẫn mang nặng ảnh hưởng bởi lịch sử Ba Lan và thần thoại Đông Âu. Series về gã thuật sĩ Geralt xứ Rivia đã được dịch ra trên 37 thứ tiếng, biến Sapkowski thành nhà văn sci-fi và fantasy được dịch nhiều thứ hai của Ba Lan, sau Stanisław Lem.<br/><b>Điều ước cuối cùng</b> và Thanh gươm của định mệnh là 2 tập truyện ngắn giới thiệu các nhân vật và thế giới của thuật sĩ, trong đó trung tâm là Geralt xứ Rivia, mở đường cho trường thiên tiểu thuyết gồm 5 tập và 1 tiểu thuyết độc lập khác. <b>The Last Wish</b> có 7 câu chuyện ngắn, mỗi câu chuyện là một sự kiện gần đây mà Geralt hồi tưởng lại khi dưỡng thương ở ngôi đền thánh của Nenneke.<br/>Năm xuất bản Polish edition: 1993<br/>Năm xuất bản English edition: 2007",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1 (Phần 1): Thợ săn quái vật",
        "url": [""],
        "dur": "35:33",
        "img": "TwlLsu3Uju8",
        "eTit": "The Witcher"
      },
      {
        "stt": 2,
        "tit": "Chương 1 (Phần 2): Thợ săn quái vật",
        "url": [""],
        "dur": "38:02",
        "img": "fDNI3nH8lbs",
        "eTit": "The Witcher"
      },
      {
        "stt": 3,
        "tit": "Chương 2 (Phần 1): Hạt của sự thật",
        "url": [""],
        "dur": "48:32",
        "img": "M_C3PymjqzA",
        "eTit": "A grain of truth"
      },
      {
        "stt": 4,
        "tit": "Chương 2 (Phần 2): Hạt của sự thật",
        "url": [""],
        "dur": "52:03",
        "img": "ewfpDYXDxa4",
        "eTit": "A grain of truth"
      },
      {
        "stt": 5,
        "tit": "Chương 3 (Phần 1): Tội ác cứu cánh",
        "url": [""],
        "dur": "55:07",
        "img": "aZwO3ZOHoMU",
        "eTit": "The lesser evil"
      },
      {
        "stt": 6,
        "tit": "Chương 3 (Phần 2): Tội ác cứu cánh",
        "url": [""],
        "dur": "55:07",
        "img": "AtfAe0vukWc",
        "eTit": "The lesser evil"
      },
      {
        "stt": 7,
        "tit": "Chương 4 (Phần 1): Vấn đề mức giá",
        "url": [""],
        "dur": "45:18",
        "img": "BzKgtBwUIdY",
        "eTit": "A question of price"
      },
      {
        "stt": 8,
        "tit": "Chương 4 (Phần 2): Vấn đề mức giá",
        "url": [""],
        "dur": "1:03:07",
        "img": "NHh5jn7AWo4",
        "eTit": "A question of price"
      },
      {
        "stt": 9,
        "tit": "Chương 5 (Phần 1): Giữa hai thế giới",
        "url": [""],
        "dur": "45:20",
        "img": "fDmDsAMnBok",
        "eTit": "The edge of the world"
      },
      {
        "stt": 10,
        "tit": "Chương 5 (Phần 2): Giữa hai thế giới",
        "url": [""],
        "dur": "42:21",
        "img": "3n2FAdBaBkw",
        "eTit": "The edge of the world"
      },
      {
        "stt": 11,
        "tit": "Chương 5 (Phần 3): Giữa hai thế giới",
        "url": [""],
        "dur": "44:28",
        "img": "iWnkMejVkVc",
        "eTit": "The edge of the world"
      },
      {
        "stt": 12,
        "tit": "Chương 6 (Phần 1): Nguyện ước cuối cùng",
        "url": [""],
        "dur": "40:38",
        "img": "REMah38Q7CY",
        "eTit": "The last wish"
      },
      {
        "stt": 13,
        "tit": "Chương 6 (Phần 2): Nguyện ước cuối cùng",
        "url": [""],
        "dur": "48:05",
        "img": "_SzYHOxsnSg",
        "eTit": "The last wish"
      },
      {
        "stt": 14,
        "tit": "Chương 6 (Phần 3): Nguyện ước cuối cùng",
        "url": [""],
        "dur": "41:45",
        "img": "YWzD-BwF_6M",
        "eTit": "The last wish"
      },
      {
        "stt": 15,
        "tit": "Chương 6 (Phần 4): Nguyện ước cuối cùng",
        "url": [""],
        "dur": "56:08",
        "img": "bLHwbOg2z0g",
        "eTit": "The last wish"
      }
    ]
  },
  {
    "title": "The Witcher - Thanh gươm của định mệnh",
    "eTitle": "Sword of Destiny - Miecz przeznaczenia",
    "author": "Andrzej Sapkowski",
    "type": "Kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.nae.vn/ttv/ttv/public/images/story/b1294c15d0bf8b8738499761f12887a2b6b791b55e1ae22793d2f57723a28097.jpg",
    "ssrc": [
      "https://radiotruyen.info/sach-noi/sword-of-destiny-the-witcher-series-snv.html",
      "https://archive.org/details/sword-02",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aiqlOCf2dA9EOlscpw6bE3I9"
    ],
    "grp": ["WTCH.TAP2$7", "WTCH.RIN-TN", "WTCH.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/sword-02/sword-<*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aiqlOCf2dA9EOlscpw6bE3I9"
    },
	"tap": [
	  {"label": "The limits of possibility" , "f": 1, "t": 5},
	  {"label": "A shard of ice" , "f": 6, "t": 8},
	  {"label": "The eternal fire" , "f": 9, "t": 11},
	  {"label": "A little sacrifice", "f": 12, "t": 16},
	  {"label": "The sword of destiny", "f": 17, "t": 20},
	  {"label": "Something more", "f": 21, "t": 23}
	],
    "year": 1992,
    "intro": "Điều ước cuối cùng (The Last Wish) và <b>Thanh gươm của định mệnh</b> (Sword of Destiny) là 2 tập truyện ngắn giới thiệu các nhân vật và thế giới của thuật sĩ. Mặc dù xuất bản năm 1992, trước The Last Wish nhưng Thanh gươm của định mệnh lại chứa nhiều sự kiện diễn ra sau.<br/>Geralt là một witcher, một người với sức mạnh phép thuật, được tăng cường thể chất bằng những năm tháng khổ luyện và thần dược bí ẩn, khiến anh trở thành một chiến binh dũng mãnh và một sát thủ tàn nhẫn. Tuy vậy anh không phải là một kẻ giết người tầm thường: mục tiêu của anh là những con quái vật và ác quỷ xấu xa đang hoành hành khắp thế giới và tấn công những người vô tội.<br/><b>Sword of Destiny</b> bao gồm 6 truyện ngắn, trong đó giới thiệu về những nhân vật sẽ trở thành nhân vật chính trong The Witcher Saga, trong đó có Ciri. Câu chuyện cuối cùng <i>Something More</i> là dẫn nhập trực tiếp vào tuyến truyện chính Saga.<br/>Năm xuất bản Polish Edition: 1992<br/>Năm xuất bản English Edition: 2015.",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1 (Phần 1): Giới hạn của những điều khả thi",
        "url": [""],
        "dur": "32:18",
        "img": "RoA-gVIazY8",
		"eTit": "The limits of possibility"
      },
      {
        "stt": 2,
        "tit": "Chương 1 (Phần 2): Giới hạn của những điều khả thi",
        "url": [""],
        "dur": "55:26",
        "img": "pzpng4BjXak",
		"eTit": "The limits of possibility"
      },
      {
        "stt": 3,
        "tit": "Chương 1 (Phần 3): Giới hạn của những điều khả thi",
        "url": [""],
        "dur": "43:48",
        "img": "2KtcR1mfI_E",
		"eTit": "The limits of possibility"
      },
      {
        "stt": 4,
        "tit": "Chương 1 (Phần 4): Giới hạn của những điều khả thi",
        "url": [""],
        "dur": "30:26",
        "img": "nQuxXaLEpa0",
		"eTit": "The limits of possibility"
      },
      {
        "stt": 5,
        "tit": "Chương 1 (Phần 5): Giới hạn của những điều khả thi",
        "url": [""],
        "dur": "44:34",
        "img": "lyaWyZ5FqIg",
		"eTit": "The limits of possibility"
      },
      {
        "stt": 6,
        "tit": "Chương 2 (Phần 1): Một mảnh băng",
        "url": [""],
        "dur": "40:08",
        "img": "MTOd3cBpFKg",
		"eTit": "A shard of ice"
      },
      {
        "stt": 7,
        "tit": "Chương 2 (Phần 2): Một mảnh băng",
        "url": [""],
        "dur": "35:39",
        "img": "In6DkQRrMfk",
		"eTit": "A shard of ice"
      },
      {
        "stt": 8,
        "tit": "Chương 2 (Phần 3): Một mảnh băng",
        "url": [""],
        "dur": "25:35",
        "img": "y2P5hHbxP3k",
		"eTit": "A shard of ice"
      },
      {
        "stt": 9,
        "tit": "Chương 3 (Phần 1): Ngọn lửa vĩnh hằng",
        "url": [""],
        "dur": "54:51",
        "img": "j6w9v-r0jg4",
		"eTit": "The eternal fire"
      },
      {
        "stt": 10,
        "tit": "Chương 3 (Phần 2): Ngọn lửa vĩnh hằng",
        "url": [""],
        "dur": "50:56",
        "img": "-fVE4Uo3C4c",
		"eTit": "The eternal fire"
      },
      {
        "stt": 11,
        "tit": "Chương 3 (Phần 3): Ngọn lửa vĩnh hằng",
        "url": [""],
        "dur": "28:34",
        "img": "p6p1AMSzTN8",
		"eTit": "The eternal fire"
      },
      {
        "stt": 12,
        "tit": "Chương 4 (Phần 1): Một chút hy sinh",
        "url": [""],
        "dur": "22:00",
        "img": "7qNPqYmz_oY",
		"eTit": "A little sacrifice"
      },
      {
        "stt": 13,
        "tit": "Chương 4 (Phần 2): Một chút hy sinh",
        "url": [""],
        "dur": "29:46",
        "img": "bUunf0fjpNM",
		"eTit": "A little sacrifice"
      },
      {
        "stt": 14,
        "tit": "Chương 4 (Phần 3): Một chút hy sinh",
        "url": [""],
        "dur": "31:23",
        "img": "pt2iNAk5JIc",
		"eTit": "A little sacrifice"
      },
      {
        "stt": 15,
        "tit": "Chương 4 (Phần 4): Một chút hy sinh",
        "url": [""],
        "dur": "38:42",
        "img": "FSiBOjP8jVs",
		"eTit": "A little sacrifice"
      },
      {
        "stt": 16,
        "tit": "Chương 4 (Phần 5): Một chút hy sinh",
        "url": [""],
        "dur": "27:53",
        "img": "NCW2va-PHOk",
		"eTit": "A little sacrifice"
      },
      {
        "stt": 17,
        "tit": "Chương 5 (Phần 1): Thanh gươm của định mệnh",
        "url": [""],
        "dur": "43:52",
        "img": "2tougGX7jcc",
		"eTit": "The sword of destiny"
      },
      {
        "stt": 18,
        "tit": "Chương 5 (Phần 2): Thanh gươm của định mệnh",
        "url": [""],
        "dur": "48:17",
        "img": "GWO8cH3G4vc",
		"eTit": "The sword of destiny"
      },
      {
        "stt": 19,
        "tit": "Chương 5 (Phần 3): Thanh gươm của định mệnh",
        "url": [""],
        "dur": "32:47",
        "img": "nAtFsN7v568",
		"eTit": "The sword of destiny"
      },
      {
        "stt": 20,
        "tit": "Chương 5 (Phần 4): Thanh gươm của định mệnh",
        "url": [""],
        "dur": "35:38",
        "img": "l_QAmBU4bJg",
		"eTit": "The sword of destiny"
      },
      {
        "stt": 21,
        "tit": "Chương 6 (Phần 1): Something more",
        "url": [""],
        "dur": "40:39",
        "img": "MLUoL0Q0OAs"
      },
      {
        "stt": 22,
        "tit": "Chương 6 (Phần 2): Something more",
        "url": [""],
        "dur": "48:58",
        "img": "ZE6thZoFCbA"
      },
      {
        "stt": 23,
        "tit": "Chương 6 (Phần 3): Something more",
        "url": [""],
        "dur": "48:24",
        "img": "sslyxpqVkgI"
      }
    ]
  },
  {
    "title": "The Witcher - Mùa mưa bão",
    "eTitle": "Season of Storms - Sezon burz",
    "author": "Andrzej Sapkowski",
    "type": "Kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://upload.wikimedia.org/wikipedia/en/8/84/Season_of_Storms_Orion.jpg",
    "ssrc": [
      "https://radiotruyen.info/sach-noi/season-of-storms-the-witcher-series-snv.html",
      "https://archive.org/details/season-4_202202",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aiq1OCHym1gLFTlV63Tf-bvu"
    ],
    "grp": ["WTCH.TAP3$7", "WTCH.RIN-TN", "WTCH.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 1,
          "wcSrc": "https://archive.org/download/season-4_202202/season-<*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aiq1OCHym1gLFTlV63Tf-bvu"
    },
    "year": 2013,
    "intro": "<b>Season of Storms</b> (tiếng Ba Lan: Sezon burz) là cuốn tiểu thuyết thứ 6 và cuốn sách thứ 8 trong series the Witcher viết bởi nhà văn thể loại kỳ ảo (fantasy) người Ba Lan Andrzej Sapkowski, được lần đầu xuất bản tại Ba Lan ngày 6-11-2013. Season of Storms là tiểu thuyết độc lập, không nằm trong bộ truyện chính Witcher Saga, mà là các câu truyện ngắn tiếp nối cuốn sách đầu tiên The Last Wish.<br/>Geralt xứ Rivia phải chiến đầu với con quái vật hung dữ có mục tiêu duy nhất là tiêu diệt con người. Không lâu sau, anh bị bắt và bị thất lạc hai thanh kiếm Witcher vô giá của mình ở Kerack. Với sự giúp đỡ của bạn mình là nhà thơ Dandelion và các mối quan hệ cá nhân, anh đã lấy lại được những vũ khí bị thất lạc của mình. Anh vướng vào mối quan hệ với phù thủy (sorceress) Lytta Neyd (nicknamed Coral, một trong 14 phù thủy ngã xuống trong trận chiến đồi Sodden), gặp gỡ nhiều nhân vật quyền lực. Geralt bị kéo vào 2 âm mưu, một liên quan đến một nhóm phù thủy, một liên quan đến Belohun - vua Kerack và con trai hắn - Osmyk.<br/>Năm xuất bản Polish Edition: 6-11-2013<br/>Năm xuất bản English Edition: 22-5-2018",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1",
        "url": [""],
        "dur": "29:46",
        "img": "HG7HCcMr1Ts"
      },
      {
        "stt": 2,
        "tit": "Chương 2",
        "url": [""],
        "dur": "21:21",
        "img": "1z2HFBDXMpI"
      },
      {
        "stt": 3,
        "tit": "Chương 3",
        "url": [""],
        "dur": "9:55",
        "img": "F86wt5aCnQY"
      },
      {
        "stt": 4,
        "tit": "Chương 4",
        "url": [""],
        "dur": "30:58",
        "img": "lBQyLZurPeI"
      },
      {
        "stt": 5,
        "tit": "Chương 5",
        "url": [""],
        "dur": "20:39",
        "img": "5WUafjXWzHM"
      },
      {
        "stt": 6,
        "tit": "Chương 6",
        "url": [""],
        "dur": "21:50",
        "img": "2I4bcaViSyA"
      }
    ]
  },
  {
    "title": "The Witcher Saga - Quyển 1. Dòng máu yêu tộc",
    "eTitle": "Blood of Elves - Krew elfów",
    "author": "Andrzej Sapkowski",
    "type": "Kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.nae.vn/ttv/ttv/public/images/story/48fb39fa00f77e3a42a0fd88e6527427370bd26a6b8c0cfbffb89f5b21afe4d3.jpg",
    "ssrc": [
      "https://radiotruyen.info/sach-noi/blood-of-elves-the-witcher-series-snv.html",
      "https://archive.org/details/blood-13",
      "https://archive.org/details/14_20240620",
      "https://www.youtube.com/playlist?list=PL2hapJAo6airVEpmXmKMLH28AdYZvFZON"
    ],
    "grp": ["WTCH.QUE1$8", "WTCH.RIN-TT", "WTCH.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/14_20240620/<*~~*>.mp3"
        },
        {
          "urlLine": 1,
          "nd": 2,
          "wcSrc": "https://archive.org/download/blood-13/blood-<*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6airVEpmXmKMLH28AdYZvFZON"
    },
    "year": 1994,
    "intro": "Là cuốn đầu tiên trong 5 cuốn tuyến truyện chính thức trong The Witcher Saga, bao gồm: <b>Blood of Elves</b>, Time of Contempt, Baptism of Fire, The Swallow’s Tower, Lady of the Lake.<br/> Trong vòng hơn một thế kỷ, con người, người lùn, gnome, và elves đã chung sống trong hòa bình. Nhưng thời thế đã thay đổi, hòa bình đã chấm dứt, và các chủng tộc giờ đây lại xung đột lẫn nhau. Trước khi câu chuyện của Geralt xứ Rivia xảy ra, hầu hết phần phía Nam của Lục Địa đều do Đế Chế Nilfgaard nắm giữ, phần phía Bắc thuộc về Vương Quốc Phương Bắc. Witcher saga đặt bối cảnh trong khoảng thời gian sau khi cuộc chiến đầu tiên giữa hai vùng lãnh thổ này vừa kết thúc, và đến giữa saga cuộc chiến thứ hai tiếp tục bắt đầu. <br/>Câu chuyện của Geralt xứ Rivia bắt đầu khi Đế Chế Nilfgaard tấn công Vương Quốc Cintra. Nữ hoàng Calanthe của vương quốc tự sát, còn cháu gái của bà là Cirilla (thường gọi Ciri) chạy thoát thân khỏi thủ phủ đang rực cháy. Ciri là đứa trẻ trong lời tiên tri, đứa trẻ này có sức mạnh thay đổi cả thế giới - dù tốt, hay xấu. Trong khi nguy cơ chiến tranh treo trên toàn vùng đất và đứa trẻ bị săn lùng vì sức mạnh phi thường của mình. Emhyr var Emreis, Hoàng Đế của Nilfgaard, ra lệnh cho tay sai tìm kiếm ráo riết Ciri (Emhyr đuổi theo Ciri không chỉ bởi vì dòng máu hoàng tộc của cô, mà còn bởi tiềm năng ma thuật cũng như dòng máu Elf chảy trong huyết quản của cô).<br/>Geralt xứ Rivia xuất hiện trong tác phẩm với tư cách là người bảo trợ Ciri. Geralt mang Ciri đến Kaer Morhen, thành trì của Witcher, để sinh sống và luyện tập các kĩ năng của một Witcher. Trong suốt quá trình luyện tập, Ciri xuất hiện những dấu hiệu lạ mà Geralt không thể hiểu được, anh ta phải nhờ đến lời khuyên của Triss Merigold (một nữ pháp sư). Triss nhận ra rằng Ciri chính là một Suối Nguồn, nhưng cô không có năng lực để điều khiển sức mạnh của Ciri, Triss đề nghị Geralt tìm đến Yennefer, một nữ pháp sư quyền năng hơn cô gấp nhiều lần, đồng thời cũng là người tình cũ của Geralt.<br/>Câu chuyện tiếp tục vào mùa xuân, khi Geralt rời Kaer Morhen cùng Triss để đưa Ciri đến học tại Trường học Đền Thánh ở Ellander nơi mà cô bé sẽ nhận được một nền giáo dục bình thường từ Nenneke. Tại đây Ciri gặp gỡ Yennefer và được cô dạy phép thuật, dần dần giữa hai người hình thành một mối gắn kết bền chặt như mẹ con.<br/>Năm xuất bản Polish Edition: 1994<br/>Năm xuất bản English Edition: 2008<br/><b>Line 1 thiếu 10 chương cuối </b>",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1 - Phần 1",
        "url": ["", ""],
        "dur": "32:11",
        "img": "M5nk-JaUVHM"
      },
      {
        "stt": 2,
        "tit": "Chương 1 - Phần 2",
        "url": ["", ""],
        "dur": "25:15",
        "img": "Zut-eC3RJRo"
      },
      {
        "stt": 3,
        "tit": "Chương 2",
        "url": ["", ""],
        "dur": "30:53",
        "img": "j501CWCkXjU"
      },
      {
        "stt": 4,
        "tit": "Chương 3",
        "url": ["", ""],
        "dur": "27:20",
        "img": "ipGUnylihYk"
      },
      {
        "stt": 5,
        "tit": "Chương 4",
        "url": ["", ""],
        "dur": "40:23",
        "img": "ZJvqP194KwQ"
      },
      {
        "stt": 6,
        "tit": "Chương 5",
        "url": ["", ""],
        "dur": "27:56",
        "img": "XsvgVrtnk4w"
      },
      {
        "stt": 7,
        "tit": "Chương 6",
        "url": ["", ""],
        "dur": "21:03",
        "img": "AMJSMBRZ9wM"
      },
      {
        "stt": 8,
        "tit": "Chương 7",
        "url": ["", ""],
        "dur": "36:56",
        "img": "36Y3PC5JB6k"
      },
      {
        "stt": 9,
        "tit": "Chương 8",
        "url": ["", ""],
        "dur": "20:50",
        "img": "58NyWTTuRVA"
      },
      {
        "stt": 10,
        "tit": "Chương 9",
        "url": ["", ""],
        "dur": "29:52",
        "img": "Cro37f96NZ0"
      },
      {
        "stt": 11,
        "tit": "Chương 10",
        "url": ["", ""],
        "dur": "33:41",
        "img": "Ta43A3m6jEo"
      },
      {
        "stt": 12,
        "tit": "Chương 11",
        "url": ["", ""],
        "dur": "49:00",
        "img": "GOEkfvQwBAk"
      },
      {
        "stt": 13,
        "tit": "Chương 12",
        "url": ["", ""],
        "dur": "49:47",
        "img": "IOygVEifGuE"
      },
      {
        "stt": 14,
        "tit": "Chương 13",
        "url": [""],
        "dur": "1:05:25",
        "img": "eeyyuFJbNKA"
      },
      {
        "stt": 15,
        "tit": "Chương 14",
        "url": [""],
        "dur": "49:13",
        "img": "TdbazKezqO4"
      },
      {
        "stt": 16,
        "tit": "Chương 15",
        "url": [""],
        "dur": "45:39",
        "img": "9iIf-y8mgpw"
      },
      {
        "stt": 17,
        "tit": "Chương 16",
        "url": [""],
        "dur": "22:08",
        "img": "uh6vHRa1gkw"
      },
      {
        "stt": 18,
        "tit": "Chương 17",
        "url": [""],
        "dur": "36:35",
        "img": "hNcG1PqgAxE"
      },
      {
        "stt": 19,
        "tit": "Chương 18",
        "url": [""],
        "dur": "25:18",
        "img": "w20yJ8LbucY"
      },
      {
        "stt": 20,
        "tit": "Chương 19",
        "url": [""],
        "dur": "29:14",
        "img": "WNWzZvO0TDc"
      },
      {
        "stt": 21,
        "tit": "Chương 20",
        "url": [""],
        "dur": "30:38",
        "img": "pSVubrM7NOM"
      },
      {
        "stt": 22,
        "tit": "Chương 21",
        "url": [""],
        "dur": "28:22",
        "img": "VpQi-CdkneE"
      },
      {
        "stt": 23,
        "tit": "Chương 22 (The End)",
        "url": [""],
        "dur": "50:00",
        "img": "vHlDHi9M4GE"
      }
    ]
  },
  {
    "title": "The Witcher Saga - Quyển 2. Một thời khinh suất",
    "eTitle": "Time of Contempt - Czas pogardy",
    "author": "Andrzej Sapkowski",
    "type": "Kỳ ảo",
    "mc": "Rin Mabuko",
    "cover": "https://www.nae.vn/ttv/ttv/public/images/story/48fb39fa00f77e3a42a0fd88e6527427370bd26a6b8c0cfbffb89f5b21afe4d3.jpg",
    "ssrc": [
      "https://archive.org/details/07_20240620_202406",
      "https://www.youtube.com/playlist?list=PL2hapJAo6aio3jE0km6DREcJ6Wqjv1A0a"
    ],
    "grp": ["WTCH.QUE2$8", "WTCH.RIN-TT", "WTCH.RIN"],
    "wc": {
      "url": [
        {
          "urlLine": 0,
          "nd": 2,
          "wcSrc": "https://archive.org/download/07_20240620_202406/<*~~*>.mp3"
        }
      ],
      "img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
      "oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aio3jE0km6DREcJ6Wqjv1A0a"
    },
    "year": 1995,
    "intro": "Là cuốn thứ 2 trong 5 cuốn tuyến truyện chính thức trong The Witcher Saga, bao gồm: Blood of Elves, <b>Time of Contempt</b>, Baptism of Fire, The Swallow’s Tower, Lady of the Lake. Witcher saga đặt bối cảnh trong khoảng thời gian sau khi cuộc chiến đầu tiên giữa hai vùng lãnh thổ này vừa kết thúc, và giữa saga cuộc chiến thứ hai tiếp tục bắt đầu. Lục Địa được chia thành bốn vùng:<br/>- Vương quốc <i>phương Bắc</i> gồm Aedirn, Cidaris, Cintra, Liên Minh Hengfors, Kaedwen, Kerack, Kovir và Poviss, Lyria và Rivia, Redania, Temeria và Verden cùng một số lãnh địa của các công tước và công quốc.<br/>- Đế Chế Nilfgaard ở <i>phương Nam</i>.<br/>- <i>Phương Đông</i> gồm sa mạc Korath, Zerrikania, Hakland và vùng núi Fiery (những nơi này chưa được biết đến).<br/>- Các vùng đất bên kia đại dương (chỉ có một số được nhắc đến như Zangvebar, Ofir, Hannu và Barsa).<br/><br/>Truyện bắt đầu khi Yennefer đưa Ciri rời khỏi đến thánh ở Ellander tới gia nhập trường dòng Aretuza để tiếp tục học phép thuật. Trong buổi đại hội của pháp sư ở đảo Thanedd, Geralt, Ciri và Yennefer bị vướng vào cuộc nổi loạn do Vilgefortz (pháp sư người  Kovirian, là người cầm đầu hội pháp sư, kẻ hợp tác với  Emhyr var Emreis, Hoàng để Nilfgaard), Philippa Eilhart và Dijkstra (một phù thủy và một trùm gián điệp của vua Redania) cầm đầu, Ciri chạy thoát qua cổng dịch chuyển Tor Lara (còn gọi là Gulls' Tower) trong khi Geraltbị thương nặng khi chặn Vilgefortz. Chiến tranh nổ ra trên khắp các vùng đất, và Ciri - người nắm giữ vận mệnh của thế giới trong tay, đã biến mất. Ciri bị dịch chuyển tới sa mạc Korath, sau đó thoát khỏi tới Nilfgaard. Bị một tên săn người bắt đi nhưng được nhóm cướp Rats cứu. Với kỹ năng học được ở Kaer Morhen, cô trở thành một thành viên của nhóm, lấy tên là Falka.<br/>Năm xuất bản Polish Edition: 1995<br/>Năm xuất bản English Edition: 2013<br/><i>Sách vẫn tiếp tục đọc và cập nhật trên Youtube</i>",
    "parts": [
      {
        "stt": 1,
        "tit": "Chương 1",
        "url": [""],
        "dur": "26:27",
        "img": "rYlj6QTv3-A"
      },
      {
        "stt": 2,
        "tit": "Chương 2",
        "url": [""],
        "dur": "46:11",
        "img": "aaXnfYiF-4U"
      },
      {
        "stt": 3,
        "tit": "Chương 3",
        "url": [""],
        "dur": "38:02",
        "img": "qyuo7DGq9Xg"
      },
      {
        "stt": 4,
        "tit": "Chương 4",
        "url": [""],
        "dur": "38:06",
        "img": "4opUoZnbBq0"
      },
      {
        "stt": 5,
        "tit": "Chương 5",
        "url": [""],
        "dur": "46:28",
        "img": "sQVx4IPSteI"
      },
      {
        "stt": 6,
        "tit": "Chương 6",
        "url": [""],
        "dur": "50:37",
        "img": "t7q-UDlCN_g"
      },
      {
        "stt": 7,
        "tit": "Chương 7",
        "url": [""],
        "dur": "1:01:55",
        "img": "At5rkh_F7Q8"
      },
      {
        "stt": 8,
        "tit": "Chương 8",
        "url": [""],
        "dur": "48:28",
        "img": "Zp8Aw06LiZ0"
      },
      {
        "stt": 9,
        "tit": "Chương 9",
        "url": [""],
        "dur": "27:42",
        "img": "w2GvKTTnjJc"
      },
      {
        "stt": 10,
        "tit": "Chương 10",
        "url": [""],
        "dur": "23:14",
        "img": "A2PH6HrhsGA"
      },
      {
        "stt": 11,
        "tit": "Chương 11",
        "url": [""],
        "dur": "21:40",
        "img": "7dsCMxAAjwI"
      },
      {
        "stt": 12,
        "tit": "Chương 12",
        "url": [""],
        "dur": "37:02",
        "img": "QeObVGBZly0"
      },
      {
        "stt": 13,
        "tit": "Chương 13",
        "url": [""],
        "dur": "35:03",
        "img": "Pej66ounbvs"
      },
      {
        "stt": 14,
        "tit": "Chương 14",
        "url": [""],
        "dur": "30:35",
        "img": "xHFn0b8Pm_4"
      },
      {
        "stt": 15,
        "tit": "Chương 15",
        "url": [""],
        "dur": "24:12",
        "img": "YMAcprymjtg"
      },
      {
        "stt": 16,
        "tit": "Chương 16",
        "url": [""],
        "dur": "41:45",
        "img": "7BUgnBtP4JU"
      },
      {
        "stt": 17,
        "tit": "Chương 17",
        "url": [""],
        "dur": "39:18",
        "img": "Pbyh5onAdTs"
      },
      {
        "stt": 18,
        "tit": "Chương 18",
        "url": [""],
        "dur": "34:18",
        "img": "Qqf8YypVAxk"
      },
      {
        "stt": 19,
        "tit": "Chương 19",
        "url": [""],
        "dur": "21:47",
        "img": "UBs9QMl_Oj4"
      },
      {
        "stt": 20,
        "tit": "Chương 20",
        "url": [""],
        "dur": "48:37",
        "img": "CxXC37Uptqc"
      }
    ]
  }
]};

const gotData = {
"meta" : {
	"name" : "Trò Chơi Vương Quyền",
	"eName" : "A Song of Ice and Fire",
	"bookGrp" : [
		[ {"label": "A Song of Ice and Fire" , "gId": "$9"} ],
		[ {"label": "Trò Chơi Vương Quyền", "gId": "GOT.RIN"} ],
		[ {"label": "Trò Chơi Vương Quyền", "gId": "GOT.RIN"} ]
	]
},
"books": [
	{
	  "title": "Trò Chơi Vương Quyền 1A - Sói Tuyết Thành Winterfell",
	  "eTitle": "A Game of Thrones 1A - Wolves of Winterfell",
	  "author": "George R. R. Martin",
	  "type": "Thiên anh hùng ca - Kỳ ảo",
	  "mc": "Rin Mabuko",
	  "cover": "https://thuviensach.vn/img/news/2022/11/larger/12870-tro-choi-vuong-quyen-george-r-r-martin-1a-1.jpg",
	  "ssrc": [
		"https://archive.org/details/31_20240627",
		"https://www.youtube.com/playlist?list=PL2hapJAo6aioynvLtaexhLZ5sflAIuuN8",
		"https://www.youtube.com/playlist?list=PLPVZE3bjpl1ptLCg5lPvKXqe8ubPoPSF-"
	  ],
	  "grp": ["GOT.TAP1A$9", "GOT.RIN", "GOT.RIN"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/31_20240627/<*~~*>.mp3"
		  }
		],
		"img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
		"oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PL2hapJAo6aioynvLtaexhLZ5sflAIuuN8"
	  },
	  "year": 1996,
	  "intro": "Trò chơi vương quyền (được biết đến với tên gọi A Song of Ice and Fire hay Game of Thrones) là bộ tiểu thuyết sử thi hùng tráng của nhà biên kịch, nhà văn Mỹ nổi tiếng George R. R. Martin. Martin bắt tay vào viết bộ tiểu thuyết này năm 1991 và xuất bản tập đầu tiên, A Game of Thrones, vào năm 1996. Sau đó, ông dần mở rộng kế hoạch 3 tập đầu tiên thành 4, 6 và cuối cùng là 7 tập. Tập 5 – A Dance with Dragons hoàn thành sau hơn 5 năm và được xuất bản vào năm 2011. Cuốn thứ 6 – The Winds of Winter vẫn đang được ông thực hiện. Bộ tiểu thuyết đã được bán bản quyền trên 40 nước. Tại Mỹ, tập thứ tư và thứ năm liên tục đứng ở vị trí số một trong Danh sách bán chạy nhất tại nhiều bảng xếp hạng uy tín như New York times, Amazon… Về số lượng, series này đã bán được hơn 7 triệu bản tại Mỹ và hơn 22 bản trên toàn thế giới. Kênh truyền hình HBO đã chuyển thể bộ tiểu thuyết này sang series phim truyền hình chất lượng cao, đậm chất Hollywood khiến danh tiếng của bộ sách cũng như tên tuổi của tác giả ngày càng vang xa. Bộ sách cũng được chuyển thể thành game phục vụ độc giả yêu thích.<br/>Trò chơi vương quyền Game of Thrones viết về cuộc chiến tranh giành quyền lực của bảy lãnh chúa vùng đất Weterlos và Essos, gồm những khu vực do các dòng họ lớn cai trị, trong bối cảnh nhiều thế lực đen tối có sức mạnh siêu nhiên như người Ngoại nhân, quỷ bóng trắng...luôn đe dọa xâm chiếm Weterlos. Bộ sách đang được HBO chuyển thể thành phim truyền hình và đang làm mưa làm gió trên hàng chục quốc gia trên thế giới trong đó có Việt Nam.<br/>Bộ sách gồm 7 quyển:<br/>1. A Game of Thrones (1996)<br/>2. A Clash of Kings (1999)<br/>3. A Storm of Swords (2000)<br/>4. A Feast for Crows (2005)<br/>5. A Dance with Dragons (2011)<br/>6. The Winds of Winter (Đang thực hiện)<br/>7. A Dream of Spring (Đang thực hiện)<br/><br/>George Raymond Richard Martin (sinh năm 1948) là nhà biên kịch người Mỹ và là nhà văn viết truyện giả tưởng, kinh dị, khoa học viễn tưởng. Sinh ra và lớn lên trong sự nghèo khó nhưng với trí tưởng tượng phong phú của mình, ngay từ khi còn bé, ông đã bắt đầu viết và bán những câu chuyện về quái vật cho lũ trẻ con ở những khu phố khác. Ông viết hẳn một câu chuyện về vương quốc thần thoại của loài rùa – con vật cưng của mình.<br/>Sau đó, ông nhanh chóng trở thành fan cuồng nhiệt của truyện tranh, hâm mộ những câu chuyện về những siêu anh hùng. Năm 1963, ông bắt đầu tham gia vào giới fan trẻ hâm mộ truyện tranh và viết các cuốn tiểu thuyết khác nhau. Năm 1965, Martin giành giải thưởng Alley cho cuốn truyện tranh về siêu anh hùng Powerman vs Blue Barrier.<br/>Năm xuất bản: 6-8-1996.",
	  "parts": [
		{
		  "stt": 1,
		  "tit": "Chương 1: Mở Đầu",
		  "url": [""],
		  "dur": "25:52",
		  "img": "vdLxcRksLYQ"
		},
		{
		  "stt": 2,
		  "tit": "Chương 2: Bran",
		  "url": [""],
		  "dur": "20:34",
		  "img": "eUm31qzGLig"
		},
		{
		  "stt": 3,
		  "tit": "Chương 3: Catelyn",
		  "url": [""],
		  "dur": "13:48",
		  "img": "2noSh-zyVn0"
		},
		{
		  "stt": 4,
		  "tit": "Chương 4: Daenerys",
		  "url": [""],
		  "dur": "28:03",
		  "img": "fZcXZUT1_Jk"
		},
		{
		  "stt": 5,
		  "tit": "Chương 5: Eddard",
		  "url": [""],
		  "dur": "24:28",
		  "img": "8WOVcyOvZrI"
		},
		{
		  "stt": 6,
		  "tit": "Chương 6: Jon",
		  "url": [""],
		  "dur": "21:07",
		  "img": "SapqA_XuKMo"
		},
		{
		  "stt": 7,
		  "tit": "Chương 7: Catelyn",
		  "url": [""],
		  "dur": "26:01",
		  "img": "dVULN2F2B2M"
		},
		{
		  "stt": 8,
		  "tit": "Chương 8: Arya",
		  "url": [""],
		  "dur": "21:29",
		  "img": "qG8ujF2KNVw"
		},
		{
		  "stt": 9,
		  "tit": "Chương 9: Bran",
		  "url": [""],
		  "dur": "23:02",
		  "img": "4EX2j8nqLOA"
		},
		{
		  "stt": 10,
		  "tit": "Chương 10: Tyrion",
		  "url": [""],
		  "dur": "16:17",
		  "img": "Am0Ps2cgHd0"
		},
		{
		  "stt": 11,
		  "tit": "Chương 11: Jon",
		  "url": [""],
		  "dur": "15:31",
		  "img": "HPsxtSrLJH8"
		},
		{
		  "stt": 12,
		  "tit": "Chương 12: Daenerys",
		  "url": [""],
		  "dur": "24:46",
		  "img": "nmPknQvdnCs"
		},
		{
		  "stt": 13,
		  "tit": "Chương 13: Eddard",
		  "url": [""],
		  "dur": "22:41",
		  "img": "I5IQNmC1sYo"
		},
		{
		  "stt": 14,
		  "tit": "Chương 14: Tyrion",
		  "url": [""],
		  "dur": "23:17",
		  "img": "PGlaDOWnLzI"
		},
		{
		  "stt": 15,
		  "tit": "Chương 15: Catelyn",
		  "url": [""],
		  "dur": "25:48",
		  "img": "qZNw89Lcuaw"
		},
		{
		  "stt": 16,
		  "tit": "Chương 16: Sansa",
		  "url": [""],
		  "dur": "33:48",
		  "img": "CG2_2tgOUpA"
		},
		{
		  "stt": 17,
		  "tit": "Chương 17: Eddard",
		  "url": [""],
		  "dur": "18:18",
		  "img": "sCEsD9KDohs"
		},
		{
		  "stt": 18,
		  "tit": "Chương 18: Bran",
		  "url": [""],
		  "dur": "12:25",
		  "img": "y2xiSd27s80"
		},
		{
		  "stt": 19,
		  "tit": "Chương 19: Catelyn",
		  "url": [""],
		  "dur": "31:46",
		  "img": "kmLc1sXZ_nA"
		},
		{
		  "stt": 20,
		  "tit": "Chương 20: Jon",
		  "url": [""],
		  "dur": "37:02",
		  "img": "LOeC0xQISCE"
		},
		{
		  "stt": 21,
		  "tit": "Chương 21: Eddard",
		  "url": [""],
		  "dur": "34:56",
		  "img": "Yh7L0EUTOe8"
		},
		{
		  "stt": 22,
		  "tit": "Chương 22: Tyrion",
		  "url": [""],
		  "dur": "30:25",
		  "img": "1l-Njo2LBmQ"
		},
		{
		  "stt": 23,
		  "tit": "Chương 23: Arya",
		  "url": [""],
		  "dur": "27:25",
		  "img": "jx4nyfe1HhU"
		},
		{
		  "stt": 24,
		  "tit": "Chương 24: Daenerys",
		  "url": [""],
		  "dur": "30:28",
		  "img": "WIeWaXRtMG0"
		},
		{
		  "stt": 25,
		  "tit": "Chương 25: Bran",
		  "url": [""],
		  "dur": "35:15",
		  "img": "xlvGOZU7MAQ"
		},
		{
		  "stt": 26,
		  "tit": "Chương 26: Eddard",
		  "url": [""],
		  "dur": "26:05",
		  "img": "1oKXBjXr-YI"
		},
		{
		  "stt": 27,
		  "tit": "Chương 27: Jon",
		  "url": [""],
		  "dur": "35:27",
		  "img": "nyMhJWr-834"
		},
		{
		  "stt": 28,
		  "tit": "Chương 28: Eddard",
		  "url": [""],
		  "dur": "32:06",
		  "img": "VG6LqZG8DKY"
		},
		{
		  "stt": 29,
		  "tit": "Chương 29: Catelyn",
		  "url": [""],
		  "dur": "27:49",
		  "img": "qQHN4g2qWH0"
		},
		{
		  "stt": 30,
		  "tit": "Chương 30: Sansa",
		  "url": [""],
		  "dur": "34:38",
		  "img": "97FKaRoSKaY"
		},
		{
		  "stt": 31,
		  "tit": "Chương 31: Eddard",
		  "url": [""],
		  "dur": "56:26",
		  "img": "xLzEVqNlPQU"
		},
		{
		  "stt": 32,
		  "tit": "Chương 32: Tyrion",
		  "url": [""],
		  "dur": "39:25",
		  "img": "SQHTQsyeSWc"
		},
		{
		  "stt": 33,
		  "tit": "Chương 33: Arya",
		  "url": [""],
		  "dur": "33:48",
		  "img": "zibqHoNd2Ks"
		},
		{
		  "stt": 34,
		  "tit": "Chương 34: Eddard",
		  "url": [""],
		  "dur": "24:14",
		  "img": "ojmUoF6H3H8"
		},
		{
		  "stt": 35,
		  "tit": "Chương 35: Catelyn",
		  "url": [""],
		  "dur": "56:11",
		  "img": "2kF7wWLtvEQ"
		},
		{
		  "stt": 36,
		  "tit": "Chương 36: Eddard",
		  "url": [""],
		  "dur": "19:13",
		  "img": "Ayl9eP5hrRg"
		},
		{
		  "stt": 37,
		  "tit": "Chương 37: Daenerys",
		  "url": [""],
		  "dur": "29:14",
		  "img": "8qdOc3aQXwE"
		},
		{
		  "stt": 38,
		  "tit": "Chương 38: Bran",
		  "url": [""],
		  "dur": "34:46",
		  "img": "5Su9CxrmwOw"
		},
		{
		  "stt": 39,
		  "tit": "Chương 39: Tyrion",
		  "url": [""],
		  "dur": "38:04",
		  "img": "e3OEO_XbHDk"
		},
		{
		  "stt": 40,
		  "tit": "Chương 40: Eddard",
		  "url": [""],
		  "dur": "20:21",
		  "img": "SsQB5vaSuvg"
		}
	  ]
	}

]};

const budData = {
"meta" : {
	"name" : "Kinh Phật Buddha",
	"eName" : "Buddhist Sutra",
	"bookGrp" : [
		[ {"label": "Kinh Phật Buddha" , "gId": "$10"} ],
		[ {"label": "Kinh Phật Buddha", "gId": "BUD.MMC"} ],
		[ {"label": "Kinh Phật Buddha", "gId": "BUD.MMC"} ]
	]
},
"books": [
	{
	  "title": "Kinh Địa Tạng Bồ Tát Bổn Nguyện - Giảng giải",
	  "eTitle": "Kinh Địa Tạng Bồ Tát Bổn Nguyện - Giảng giải",
	  "author": "Hòa thượng Tuyên Hóa thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Huy Hồ, Chiếu Thành, Ngọc Mỹ, Kiều Hạnh, Tuấn Anh, Kim Phượng, Nam Trung",
	  "cover": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAG2ffAcA2TCNyx3iDXXAhM7wyw6MSwO6zfuH2wGX-r8s8QFI46VxpKg1iVvqvgQjsNxVWsX4PXQ4ONchshGNbcJX16B6a79U6BFKuxSmcdp5PJzsGJ2E2yx5wSSGkZbAIjjXl5oFPtTWJ/s960/238909848_201163338708154_3876260034244579557_n.jpg",
	  "ssrc": [
		"https://phatphapungdung.com/sach-noi/kinh-dia-tang-bo-tat-bon-nguyen-giang-thuat-ht-tuyen-hoa-sach-noi-kinh-doc-57951.html",
		"https://kinhdiatangbotatbonnguyen.blogspot.com/"
	  ],
	  "grp": ["BUD.KDTG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
        "url": [
			{
			  "urlLine": 0,
			  "nd": -1,
			  "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/KinhDiaTangBoTatBonNguyenGiangThuat/Sach-Noi-Audio-Book-Kinh-Dia-Tang-Bo-Tat-Bon-Nguyen-Giang-Thuat-<*~~*>-www.phatphapungdung.com.mp3"
			},
			{
			  "urlLine": 1,
			  "nd": -1,
			  "wcSrc": "https://dl.dropboxusercontent.com/s/<*~~*>"
			}
		  ]
	  },
	  "year": "",
	  "tap": [
		  {"label": "Kinh Địa Tạng Bồ Tát Bổn Nguyện (quyển Thượng) - Giảng giải" , "f": 1, "t": 27},
		  {"label": "Kinh Địa Tạng Bồ Tát Bổn Nguyện (quyển Trung) - Giảng giải" , "f": 28, "t": 40},
		  {"label": "Kinh Địa Tạng Bồ Tát Bổn Nguyện (quyển Hạ) - Giảng giải" , "f": 41, "t": 52},
		  {"label": "Kinh Địa Tạng Bồ Tát Bổn Nguyện - Diễn đọc", "f": 53, "t": 54}
		],
	  "intro": "<b>Kinh Địa Tạng Bổn Nguyện</b> là một trong những bộ kinh căn bản của Phật giáo Đại thừa nói về hạnh nguyện rộng lớn của Đức Địa Tạng Bồ Tát, là bộ kinh Đức Phật vì Thánh Mẫu mà thuyết pháp tại cung Trời Đao-Lợi. Kinh Địa Tạng Bồ Tát Bổn Nguyện gồm ba quyển Thượng, Trung, Hạ với 13 phẩm, là những giáo lý căn bản mà người tu học Phật cần nắm rõ trên lộ trình giác ngộ và giải thoát. Kinh Địa Tạng Bổn Nguyện là một bộ kinh nói về công đức, oai lực của  Bồ Tát Địa Tạng thường được các chùa chiền tự viện tại các quốc gia theo khuynh hướng Đại Thừa khai tụng trong suốt tháng bảy, đặc biệt là vào dịp lễ Vu Lan, tức là mùa báo hiếu cha mẹ, tổ tiên theo truyền thống của người con Phật.<br/>Nội dung chính yếu của Kinh Địa Tạng xoay quanh chữ Hiếu, nói lên bổn phận của người sống đối với người đã quá vãng. Kinh cũng nói đến những tội phúc quả báo ở thế giới bên kia để người Phật tử nương theo kinh này cùng dựa vào oai lực độ trì, gia hộ của  Bồ Tát Địa Tạng để tu tập, hầu độ thoát cho chính mình, cho người thân cũng như tất cả chúng sanh đã quá vãng khỏi rơi vào con đường ác. Phật nói kinh Địa Tạng là cốt cảnh tỉnh tất cả chúng ta dẹp bỏ tham sân si nơi tự tâm, tu tập ba nghiệp lành nơi tự tâm, rồi dứt nghiệp cũng nơi tự tâm và giải trừ vô minh tăm tối cũng nơi tự tâm. Cuối cùng trở về với Bổn Tôn Địa Tạng của chính mình. Đó là cương lĩnh của toàn bộ kinh Địa Tạng.<br/>Hán Dịch: Tam Tạng Pháp Sư Pháp Đăng.<br/>Việt Dịch: HT Thích Trí Tịnh",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Duyên Khởi Pháp Hội Giảng Kinh",
		"dur": "20:26",
		"url": [
		  "01-Duyen-Khoi-Cua-Phap-Hoi-Giang-Kinh",
		  "uw02vs5tnzf1zgx/00_Duyen-Khoi-Cua-Phap-Hoi-Giang-Kinh.mp3"
		]
	  },
	  {
		"stt": 2,
		"tit": "Duyên Khởi Pháp Hội Giảng Kinh - Tiếp Theo",
		"dur": "32:00",
		"url": [
		  "02-Duyen-Khoi-Cua-Phap-Hoi-Giang-Kinh-Tt",
		  "4pufiyvtw4nqzch/01_Duyen-Khoi-Cua-Phap-Hoi-Giang-Kinh.mp3"
		]
	  },
	  {
		"stt": 3,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 1",
		"dur": "31:57",
		"url": [
		  "03-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi",
		  "v4hv9xyijsrqvkz/02_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 4,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 2",
		"dur": "26:11",
		"url": [
		  "04-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "zibgdbl9we83whw/03_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 5,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 3",
		"dur": "26:52",
		"url": [
		  "05-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "w33pvnddti3iuya/04_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 6,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 4",
		"dur": "35:52",
		"url": [
		  "06-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "vzwoyin4xbwksok/05_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 7,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 5",
		"dur": "20:47",
		"url": [
		  "07-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "j92ovmicsx425ve/06_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 8,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 6",
		"dur": "23:17",
		"url": [
		  "08-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "xy9cgfqarqhrde2/07_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 9,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 7",
		"dur": "23:55",
		"url": [
		  "09-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "d3nwpzdd7fziv8u/08_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 10,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 8",
		"dur": "20:07",
		"url": [
		  "10-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "fwpm1jzf8lmqab7/09_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 11,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 9",
		"dur": "26:46",
		"url": [
		  "11-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "b15tahyvr4y78l3/10_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 12,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 10",
		"dur": "20:19",
		"url": [
		  "12-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "fm7dx8esvhvmyz4/11_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 13,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 11",
		"dur": "32:21",
		"url": [
		  "13-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "p4g010btfldxd19/12_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 14,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 12",
		"dur": "25:05",
		"url": [
		  "14-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "8c5qfqr1n51a9wu/13_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 15,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 13",
		"dur": "37:42",
		"url": [
		  "15-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "j4i0ynbfytu2k15/14_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 16,
		"tit": "Phẩm 01-Thần Thông Trên Cung Trời Đao Lợi 14",
		"dur": "25:16",
		"url": [
		  "16-Pham-01-Than-Thong-Tren-Cung-Troi-Dao-Loi-Tt",
		  "pov3n3bqddu0bbl/15_Pham-01_Than-Thong-Tren-Cung-Troi-Dao-Loi.mp3"
		]
	  },
	  {
		"stt": 17,
		"tit": "Phẩm 02-Phân Thân Tập Hội",
		"dur": "25:38",
		"url": [
		  "17-Pham-02-Phan-Than-Tap-Hoi",
		  "p286q2xto1sa0y8/16_Pham-02_Phan-Than-Tap-Hoi_2.mp3"
		]
	  },
	  {
		"stt": 18,
		"tit": "Phẩm02-Phân Thân Tập Hội - Tiếp Theo",
		"dur": "32:01",
		"url": [
		  "18-Pham-02-Phan-Than-Tap-Hoi-H-Ho-Tt",
		  "3su9b38fztzo0zf/17_Pham-02_Phan-Than-Tap-Hoi.mp3"
		]
	  },
	  {
		"stt": 19,
		"tit": "Phẩm 03-Quán Chúng Sinh Nghiệp Duyên 1",
		"dur": "25:01",
		"url": [
		  "19-Pham-03-Quan-Chung-Sanh-Nghiep-Duyen",
		  "6xqv40pupgxbi0q/18_Pham-03_Quan-Chung-Sanh-Nghiep-Duyen.mp3"
		]
	  },
	  {
		"stt": 20,
		"tit": "Phẩm 03-Quán Chúng Sinh Nghiệp Duyên 2",
		"dur": "19:10",
		"url": [
		  "20-Pham-03-Quan-Chung-Sanh-Nghiep-Duyen-Tt",
		  "90l16xg6o86rt3i/19_Pham-03_Quan-Chung-Sanh-Nghiep-Duyen.mp3"
		]
	  },
	  {
		"stt": 21,
		"tit": "Phẩm 03-Quán Chúng Sinh Nghiệp Duyên 3",
		"dur": "40:19",
		"url": [
		  "21-Pham-03-Quan-Chung-Sanh-Nghiep-Duyen-Tt",
		  "rs607jule1n4ho0/20_Pham-03_Quan-Chung-Sanh-Nghiep-Duyen.mp3"
		]
	  },
	  {
		"stt": 22,
		"tit": "Phẩm 03-Quán Chúng Sinh Nghiệp Duyên 4",
		"dur": "28:41",
		"url": [
		  "22-Pham-03-Quan-Chung-Sanh-Nghiep-Duyen-Tt",
		  "0hf0qv9ntiao9v6/21_Pham-03_Quan-Chung-Sanh-Nghiep-Duyen.mp3"
		]
	  },
	  {
		"stt": 23,
		"tit": "Phẩm 04-Nghiệp Cảm Của Chúng Sanh ở Cõi Diêm Phù 1",
		"dur": "29:58",
		"url": [
		  "23-Pham-04-Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu",
		  "1j2t89v6wvjvqzz/22_Pham-04_Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu.mp3"
		]
	  },
	  {
		"stt": 24,
		"tit": "Phẩm 04-Nghiệp Cảm Của Chúng Sanh ở Cõi Diêm Phù 2",
		"dur": "35:16",
		"url": [
		  "24-Pham-04-Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu-Tt",
		  "uvhohxcak1sb7er/23_Pham-04_Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu.mp3"
		]
	  },
	  {
		"stt": 25,
		"tit": "Phẩm 04-Nghiệp Cảm Của Chúng Sanh ở Cõi Diêm Phù 3",
		"dur": "28:59",
		"url": [
		  "25-Pham-04-Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu-Tt",
		  "45jdkvms1q6wone/24_Pham-04_Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu.mp3"
		]
	  },
	  {
		"stt": 26,
		"tit": "Phẩm 04-Nghiệp Cảm Của Chúng Sanh ở Cõi Diêm Phù 4",
		"dur": "23:32",
		"url": [
		  "26-Pham-04-Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu-Tt",
		  "axhr0jl0romsjns/25_Pham-04_Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu.mp3"
		]
	  },
	  {
		"stt": 27,
		"tit": "Phẩm 04-Nghiệp Cảm Của Chúng Sanh ở Cõi Diêm Phù 5",
		"dur": "18:22",
		"url": [
		  "27-Pham-04-Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu-Tt",
		  "ewfspta3detkxm6/26_Pham-04_Nghiep-Cam-Cua-Chung-Sanh-O-Coi-Diem-Phu.mp3"
		]
	  },
	  {
		"stt": 28,
		"tit": "Phẩm 05-Danh Hiệu Của Địa Ngục",
		"dur": "24:51",
		"url": [
		  "28-Pham-05-Danh-Hieu-Cua-Dia-Nguc",
		  "0j0qrvboywc11ux/27_Pham-05_Danh-Hieu-Cua-Dia-Nguc.mp3"
		]
	  },
	  {
		"stt": 29,
		"tit": "Phẩm 05-Danh Hiệu Của Địa Ngục - Tiếp Theo",
		"dur": "19:18",
		"url": [
		  "29-Pham-05-Danh-Hieu-Cua-Dia-Nguc-Tt",
		  "szswannhn5z99ip/28_Pham-05_Danh-Hieu-Cua-Dia-Nguc.mp3"
		]
	  },
	  {
		"stt": 30,
		"tit": "Phẩm 06-Như Lai Tán Thán 1",
		"dur": "34:14",
		"url": [
		  "30-Pham-06-Nhu-Lai-Tan-Than",
		  "w68dmtra9nslt3n/29_Pham-06_Nhu-Lai-Tan-Than.mp3"
		]
	  },
	  {
		"stt": 31,
		"tit": "Phẩm 06-Như Lai Tán Thán 2",
		"dur": "34:48",
		"url": [
		  "31-Pham-06-Nhu-Lai-Tan-Than-Tt",
		  "c4z7hnkb715bnek/30_Pham-06_Nhu-Lai-Tan-Than.mp3"
		]
	  },
	  {
		"stt": 32,
		"tit": "Phẩm 06-Như Lai Tán Thán 3",
		"dur": "32:50",
		"url": [
		  "32-Pham-06-Nhu-Lai-Tan-Than-Tt",
		  "b3pk7bstmll6wbw/31_Pham-06_Nhu-Lai-Tan-Than.mp3"
		]
	  },
	  {
		"stt": 33,
		"tit": "Phẩm 06-Như Lai Tán Thán 4",
		"dur": "25:51",
		"url": [
		  "33-Pham-06-Nhu-Lai-Tan-Than-Tt",
		  "fabvttwwr5tsyug/32_Pham-06_Nhu-Lai-Tan-Than.mp3"
		]
	  },
	  {
		"stt": 34,
		"tit": "Phẩm 06-Như Lai Tán Thán 5",
		"dur": "18:24",
		"url": [
		  "34-Pham-06-Nhu-Lai-Tan-Than-Tt",
		  "5st3wiybvv8k32g/33_Pham-06_Nhu-Lai-Tan-Than.mp3"
		]
	  },
	  {
		"stt": 35,
		"tit": "Phẩm 07-Lợi Ích Kẻ Còn Người Mất",
		"dur": "30:56",
		"url": [
		  "35-Pham-07-Loi-Ich-Cho-Ca-Ke-Con-Nguoi-Mat",
		  "dacbdqsldiz7jnq/34_Pham-07_Loi-Ich-Cho-Ca-Ke-Con-Nguoi-Mat.mp3"
		]
	  },
	  {
		"stt": 36,
		"tit": "Phẩm 07-Lợi Ích Kẻ Còn Người Mất - Tiếp Theo",
		"dur": "35:11",
		"url": [
		  "36-Pham-07-Loi-Ich-Cho-Ca-Ke-Con-Nguoi-Mat-Tt",
		  "f68vux98rj197r9/35_Pham-07_Loi-Ich-Cho-Ca-Ke-Con-Nguoi-Mat.mp3"
		]
	  },
	  {
		"stt": 37,
		"tit": "Phẩm 08-Các Vua Diêm La Và Quyến Thuộc Khen Ngợi 1",
		"dur": "27:40",
		"url": [
		  "37-Pham-08-Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi",
		  "br2gjy62xqxh0vp/36_Pham-08_Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi.mp3"
		]
	  },
	  {
		"stt": 38,
		"tit": "Phẩm 08-Các Vua Diêm La Và Quyến Thuộc Khen Ngợi 2",
		"dur": "27:36",
		"url": [
		  "38-Pham-08-Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi-Tt",
		  "6g95asrsbs4q4qo/37_Pham-08_Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi.mp3"
		]
	  },
	  {
		"stt": 39,
		"tit": "Phẩm 08-Các Vua Diêm La Và Quyến Thuộc Khen Ngợi 3",
		"dur": "33:13",
		"url": [
		  "39-Pham-08-Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi-Tt",
		  "g98qe5iv0seawu7/38_Pham-08_Cac-Vua-Diem-La-Va-Quyen-Thuoc-Khen-Ngoi.mp3"
		]
	  },
	  {
		"stt": 40,
		"tit": "Phẩm 09-Xưng Danh Hiệu Chư Phật",
		"dur": "31:56",
		"url": [
		  "40-Pham-09-Xung-Danh-Hieu-Chu-Phat",
		  "hkq5jenv0tz17dh/39_Pham-09_Xung-Danh-Hieu-Chu-Phat.mp3"
		]
	  },
	  {
		"stt": 41,
		"tit": "Phẩm 10-Nhân Duyên Và So Sánh Công Đức Bố Thí",
		"dur": "19:50",
		"url": [
		  "41-Pham-10-Nhan-Duyen-Va-Su-So-Sanh-Cong-Duc-Bo-Thi",
		  "fnp6mlkutnruayy/40_Pham-10_Nhan-Duyen-Va-Su-So-Sanh-Cong-Duc-Bo-Thi.mp3"
		]
	  },
	  {
		"stt": 42,
		"tit": "Phẩm 10-Nhân Duyên Và So Sánh Công Đức Bố Thí - Tiếp Theo",
		"dur": "21:32",
		"url": [
		  "42-Pham-10-Nhan-Duyen-Va-Su-So-Sanh-Cong-Duc-Bo-Thi-Tt",
		  "dt8bij2fmlxdw7f/41_Pham-10_Nhan-Duyen-Va-Su-So-Sanh-Cong-Duc-Bo-Thi.mp3"
		]
	  },
	  {
		"stt": 43,
		"tit": "Phẩm 11-Địa Thần Hộ Pháp",
		"dur": "24:28",
		"url": [
		  "43-Pham-11-Dia-Than-Ho-Phap",
		  "k3w1pfe9ra904ag/42_Pham-11_Dia-Than-Ho-Phap.mp3"
		]
	  },
	  {
		"stt": 44,
		"tit": "Phẩm 11-Địa Thần Hộ Pháp - Tiếp Theo",
		"dur": "22:13",
		"url": [
		  "44-Pham-11-Dia-Than-Ho-Phap-Tt",
		  "6qzxkz5yejna7fz/43_Pham-11_Dia-Than-Ho-Phap.mp3"
		]
	  },
	  {
		"stt": 45,
		"tit": "Phẩm 12-Thấy Nghe Đều Được Lợi Ích 1",
		"dur": "25:17",
		"url": [
		  "45-Pham-12-Thay-Nghe-Deu-Duoc-Loi-Ich",
		  "51c40ial4gam976/44_Pham-12_Thay-Nghe-Deu-Duoc-Loi-Ich.mp3"
		]
	  },
	  {
		"stt": 46,
		"tit": "Phẩm 12-Thấy Nghe Đều Được Lợi Ích 2",
		"dur": "29:26",
		"url": ["46-Pham-12-Thay-Nghe-Deu-Duoc-Loi-Ich-Tt"]
	  },
	  {
		"stt": 47,
		"tit": "Phẩm 12-Thấy Nghe Đều Được Lợi Ích 3",
		"dur": "28:02",
		"url": ["47-Pham-12-Thay-Nghe-Deu-Duoc-Loi-Ich-Tt"]
	  },
	  {
		"stt": 48,
		"tit": "Phẩm 12-Thấy Nghe Đều Được Lợi Ích 4",
		"dur": "20:38",
		"url": ["48-Pham-12-Thay-Nghe-Deu-Duoc-Loi-Ich-Tt"]
	  },
	  {
		"stt": 49,
		"tit": "Phẩm 13-Chúc Lụy Nhân Thiên",
		"dur": "26:01",
		"url": ["49-Pham-13-Chuc-Luy-Nhan-Thien"]
	  },
	  {
		"stt": 50,
		"tit": "Phẩm 13-Chúc Lụy Nhân Thiên 1",
		"dur": "21:49",
		"url": [
		  "50-Pham-13-Chuc-Luy-Nhan-Thien-Tt",
		  "i26tzatzey0fbhw/49_Pham-13_Chuc-Luy-Nhan-Thien.mp3"
		]
	  },
	  {
		"stt": 51,
		"tit": "Phẩm 13-Chúc Lụy Nhân Thiên 2",
		"dur": "37:39",
		"url": [
		  "51-Pham-13-Chuc-Luy-Nhan-Thien-Tt",
		  "p1x1xa8jaxm247q/50_Pham-13_Chuc-Luy-Nhan-Thien.mp3"
		]
	  },
	  {
		"stt": 52,
		"tit": "Sơ Lược Tiểu Sử Hòa Thượng Tuyên Hóa - Hết",
		"dur": "26:08",
		"url": [
		  "52-So-Luoc-Tieu-Su-Hoa-Thuong-Tuyen-Hoa-Het",
		  "ph08kjvj3ug1yve/51-So-Luoc-Tieu-Su-Hoa-Thuong-Tuyen-Hoa_het.mp3"
		]
	  },
	  {
		"stt": 53,
		"tit": "Diễn đọc kinh Địa Tạng (giọng Nữ)",
		"dur": "2:36:18",
		"url": [
		  "https://dl.dropboxusercontent.com/s/dljwuv4rbhtrwn7/Doc-Kinh-Dia-Tang-Bo-Tat-Bon-Nguyen.mp3"
		]
	  },
	  {
		"stt": 54,
		"tit": "Diễn đọc kinh Địa Tạng (giọng Nam)",
		"dur": "2:20:27",
		"url": [
		  "https://ia902301.us.archive.org/14/items/kinh-dia-tang-Bo-Tat-Bon-Nguyen/Kinh Địa Tạng Bồ Tát Bổn Nguyện Đọc - (HQ).mp3"
		]
	  }
	]},
	
	{
	  "title": "Kinh Lăng Nghiêm - Giảng giải",
	  "eTitle": "Kinh Lăng Nghiêm - Giảng giải",
	  "author": "Hòa thượng Thích Thiện Hoa thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Kim Phượng, Huy Hồ, Nguyễn Đông",
	  "cover": "https://1.bp.blogspot.com/-GpLC_u5vabc/YU2VVn4mn1I/AAAAAAAAACI/6m-31Neo-KIWMhu7dMLvvUCzjXN8oEvWQCNcBGAsYHQ/s1830/242783737_880471956220478_6963117199109873754_n.jpg",
	  "ssrc": [
		"https://phatphapungdung.com/sach-noi/kinh-lang-nghiem-giang-giai-ht-thich-thien-hoa-sach-noi-kinh-doc-57954.html",
		"https://giang-giai-kinh-lang-nghiem.blogspot.com/"
	  ],
	  "grp": ["BUD.KTLNG2$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
        "url": [
			{
			  "urlLine": 0,
			  "nd": -1,
			  "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/KinhLangNghiemGiangGiai/Sach-Noi-Audio-Book-Kinh-Lang-Nghiem-Giang-Giai-<*~~*>-www.phatphapungdung.com.mp3"
			}
		  ]
	  },
	  "year": "",
	  "tap": [
		  {"label": "Kinh Lăng Nghiêm – Hòa thượng Thích Thiện Hoa thuyết giảng" , "f": 1, "t": 18},
		  {"label": "Kinh Lăng Nghiêm – Hòa thượng Tuyên Hóa thuyết giảng" , "f": 19, "t": 21}
		],
	  "intro": "Kinh <b>Thủ lăng nghiêm</b> có Tên trọn vẹn của Kinh là Đại Phật Đỉnh Như Lai Mật Nhân Tu Chứng Liễu Nghĩa Chư Bồ Tát Vạn Hạnh Thủ Lăng Nghiêm Kinh 大佛頂如來密因修證了義諸菩薩萬行首楞嚴經, tạm dịch: <i>Kinh Đại Phật Đỉnh, chứng ngộ trọn vẹn do tu hành nguyên nhân bí mật của các Như Lai, nền móng của vạn hạnh của tất cả các Bồ Tát</i>. Bộ Kinh gồm 10 quyển (Taisho Tripitaka Nº 945). Một Kinh khác có tên tương tự, Kinh Thủ Lăng Nghiêm Tam Muội 首楞嚴三昧經, gồm 2 quyển, do E Lamotte dịch.<br/>Truyền thuyết cho là Kinh Lăng Nghiêm do ngài Long Thọ 龍樹 tìm được, từ đó được các vua chúa Ấn Độ xem Kinh như quốc bảo, và việc đem Kinh ra khỏi Ấn Độ là phạm pháp. Từ triều đại nhà Tùy, vị sáng lập Thiên Thai Tông, ngài Trí Nghĩ 智顗 đã có nghe đến Kinh Lăng Nghiêm và mỗi ngày quay về hướng Tây tụng niệm cầu cho Kinh đến được Trung Hoa. Sau một lần thử đem Kinh ra khỏi Ấn Độ không kết quả, ngài Bát Lạt Mật Đế quyết định dấu Kinh trong cánh tay của mình, Kinh được bao bọc trong lụa và sáp. Khi đến Quảng Đông, ngài lấy Kinh ra từ chỗ dấu, do đó Kinh còn có biệt danh là Kinh Tẩm Máu, Huyết Tí Kinh 血漬經. Sau khi hướng dẫn dịch xong Kinh, ngài Bát Lạt Mật Đế trở về xứ nhận trách nhiệm tội lén đem Kinh ra ngoài và giải tội cho người canh phòng biên giới bị bắt giữ vì trách nhiệm lây. Khi Kinh được Phòng Dung dâng lên Võ Tắc Thiên, Kinh không được phổ biến ngay vì mới đó có một vụ tai tiếng về giả mạo kinh. Thiền sư Thần Tú 神秀 tìm thấy Kinh khi cư ngụ trong hoàng cung. Truyền thống Phật giáo Trung Hoa theo 'thiên niên' cho rằng Kinh Lăng Nghiêm là kinh cuối cùng được tìm ra và sẽ bị phá hủy trước tiên khi gần đến thời kỳ của Đức Phật Di Lạc..<br/>Trong kinh Pháp Diệt Tận có nói rất rõ ràng: 'Vào thời mạt pháp kinh Thủ lăng nghiêm bị hoại diệt trước hết, sau đó, các kinh khác dần dần biến mất.'<br/>Nếu như kinh Thủ lăng nghiêm không bị biến mất thì thời kỳ chánh pháp vẫn còn tồn tại. Tại sao lại nói kinh Thủ lăng nghiêm bị tiêu hủy trước tiên? Vì một điều quá chân thực, kinh Thủ lăng nghiêm là chân thân của Đức Phật, kinh Thủ lăng nghiêm là xá-lợi của Đức Phật, kinh Thủ lăng nghiêm là tháp miếu chân thực của Đức Phật. Do vì đạo lý trong kinh Thủ lăng nghiêm quá chân thực, nên toàn thể ma vương đều dùng mọi cách để phá hủy kinh Thủ lăng nghiêm.<br/>Hán Dịch:  Sa-môn Bát-thích-mật-đế người Trung Thiên Trúc, dịch vào đời Đường.<br/>Tuyên Hóa Thượng Nhân, Vạn Phật Thánh Thành, Bắc Mỹ Châu Hoa Kỳ lược giảng.<br/>Việt Dịch: Sa-môn Thích Nhuận Châu (phần Kinh)",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Đầu Đề Kinh Lăng Nghiêm",
		"dur": "18:11",
		"url": ["Kinh-Lang-Nghiem-Giang-Giai-001-Dau-De-Kinh-Lang-Nghiem"]
	  },
	  {
		"stt": 2,
		"tit": "Bảy Đoạn Hỏi Về Tâm",
		"dur": "19:48",
		"url": ["Kinh-Lang-Nghiem-Giang-Giai-002-Bay-Doan-Hoi-Ve-Tam"]
	  },
	  {
		"stt": 3,
		"tit": "A Nan cầu Phật Dạy Phương Pháp Tu Hành Lần Hai 1",
		"dur": "22:15",
		"url": [
		  "Kinh-Lang-Nghiem-Giang-Giai-003-Anan-Cau-Phat-Day-Pp-Tu-Hanh-Lan-2"
		]
	  },
	  {
		"stt": 4,
		"tit": "A Nan cầu Phật Dạy Phương Pháp Tu Hành Lần Hai 2",
		"dur": "22:15",
		"url": [
		  "Kinh-Lang-Nghiem-Giang-Giai-004-Anan-Cau-Phat-Day-Pp-Tu-Hanh-Lan-Hai"
		]
	  },
	  {
		"stt": 5,
		"tit": "A Nan Cầu Phật Chỉ Cái Điên Đảo",
		"dur": "19:07",
		"url": ["005-Anan-Cau-Phat-Chi-Cai-Dien-Dao"]
	  },
	  {
		"stt": 6,
		"tit": "A Nan Nghi Nếu Cái Thấy Là Mình",
		"dur": "21:15",
		"url": ["006-Anan-Nghi-Cai-Thay-La-Minh"]
	  },
	  {
		"stt": 7,
		"tit": "A Nan Không Hiểu Hỏi Phật",
		"dur": "27:48",
		"url": ["007-Anan-Khong-Hieu-Hoi-Phat"]
	  },
	  {
		"stt": 8,
		"tit": "Hư Không Từ Chơn Tâm Biến Hiện",
		"dur": "19:51",
		"url": ["008-Hu-Khong-Tu-Chon-Tam-Bien"]
	  },
	  {
		"stt": 9,
		"tit": "Ông Phú Lâu Na Hỏi",
		"dur": "26:38",
		"url": ["009-Ong-Phu-Lau-Na-Hoi"]
	  },
	  {
		"stt": 10,
		"tit": "Phật Dạy Chơn Tâm Phi Ngũ Uẩn",
		"dur": "21:33",
		"url": ["010-Phat-Day-Chon-Tam-Phi"]
	  },
	  {
		"stt": 11,
		"tit": "A Nan Thuật Lại",
		"dur": "18:47",
		"url": ["011-Anan-Thuat-Lai"]
	  },
	  {
		"stt": 12,
		"tit": "A Nan Hỏi Phật Trói Cột Ở Chỗ Nào",
		"dur": "12:07",
		"url": ["012-Anan-Hoi-Phat-Troi-Cot-O-Cho-Nao"]
	  },
	  {
		"stt": 13,
		"tit": "A Nan Hỏi Phật Pháp Tu Viên Thông 1",
		"dur": "38:38",
		"url": ["013-Anan-Hoi-Phat-Phap-Tu-Vien-Thong"]
	  },
	  {
		"stt": 14,
		"tit": "A Nan Hỏi Phật Pháp Tu Viên Thông 2",
		"dur": "41:11",
		"url": ["014-Anan-Hoi-Phat-Phap-Tu-Vien-Thong"]
	  },
	  {
		"stt": 15,
		"tit": "Phật Bảo Ngài Văn Thù Lựa Pháp Tu Viên Thông",
		"dur": "26:38",
		"url": ["015-Ph-Bao-Ngai-Van-Thu-Lua-Chon-Phap"]
	  },
	  {
		"stt": 16,
		"tit": "Phật Dạy Trì Chú Lăng Nghiêm",
		"dur": "24:14",
		"url": ["016-Phat-Day-Tri-Chu-Lang-Nghiem"]
	  },
	  {
		"stt": 17,
		"tit": "Mười Món Ma về Thọ Ấm-Tưởng Ấm",
		"dur": "24:21",
		"url": ["017-Muoi-Mon-Ma-Ve-Tho-Am-Tuong-Am"]
	  },
	  {
		"stt": 18,
		"tit": "Mười Món Ma Về Thọ Ấm-Thức Ấm - Hết",
		"dur": "36:00",
		"url": ["018-Muoi-Mon-Ma-Ve-Hanh-Am-Thuc-Am-Het"]
	  },
	  {
		"stt": 19,
		"tit": "Kinh Lăng Nghiêm – Giảng Giải - Phần 01",
		"dur": "22:36:50",
		"url": "https://archive.org/download/HTTuyenHoaKinhThuLangNghiemGiang12/HT Tuyên Hóa Kinh Thủ Lăng Nghiêm Giảng 1%262.mp3"
	  },
	  {
		"stt": 20,
		"tit": "Kinh Lăng Nghiêm – Giảng Giải - Phần 02",
		"dur": "17:58:48",
		"url": "https://archive.org/download/HTTuyenHoaKinhThLangNghiemGing34/HT Tuyên Hóa Kinh Th Lang Nghiêm Ging 3%264.mp3"
	  },
	  {
		"stt": 21,
		"tit": "Kinh Lăng Nghiêm – Giảng Giải - Phần 03",
		"dur": "12:58:39",
		"url": "https://archive.org/download/HTTuyenHoaKinhThuLangNghiemGiang56/HT Tuyên Hóa Kinh Thủ Lăng Nghiêm Giảng 5%266.mp3"
	  }
	]},
		
	{
	  "title": "Chú Lăng Nghiêm - Giảng giải",
	  "eTitle": "Chú Lăng Nghiêm - Giảng giải",
	  "author": "Hòa thượng Tuyên Hóa thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Huy Hồ, Tuấn Anh, Thanh Hồng, Ngọc Châu, Tâm Hiếu, Trần Vũ",
	  "cover": "https://1.bp.blogspot.com/-GpLC_u5vabc/YU2VVn4mn1I/AAAAAAAAACI/6m-31Neo-KIWMhu7dMLvvUCzjXN8oEvWQCNcBGAsYHQ/s1830/242783737_880471956220478_6963117199109873754_n.jpg",
	  "ssrc": [
		"https://giang-giai-kinh-lang-nghiem.blogspot.com/",
		"https://phatphapungdung.com/sach-noi/chu-lang-nghiem-giang-giai-ht-tuyen-hoa-sach-noi-kinh-doc-58273.html"
	  ],
	  "grp": ["BUD.KTLNG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
        "url": [
			{
			  "urlLine": 0,
			  "nd": -1,
			  "wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/ChuLangNghiemGiangGiai/ChuLangNghiemGiangGiai<*~~*>-www.phatphapungdung.com.mp3"
			}
		  ]
	  },
	  "year": "",
	  "tap": [
		  {"label": "Chú Lăng Nghiêm giảng giải - Tập 1", "f": 1, "t": 9},
		  {"label": "Chú Lăng Nghiêm giảng giải - Tập 2", "f": 10, "t": 21},
		  {"label": "Chú Lăng Nghiêm giảng giải - Tập 3", "f": 22, "t": 26}
		],
	  "intro": "<b>Chú Lăng Nghiêm</b> là Chú quan trọng nhất, hơn hết thảy trong các Chú, bao gồm hết thảy thể chất và diệu dụng của Phật pháp. Chú này chia làm 5 bộ: Kim Cang bộ, Bảo Sinh bộ, Liên Hoa bộ, Phật bộ, và Nghiệp bộ. Năm bộ kinh này thuộc về 5 phương:<br/>1. Kim Cang bộ: thuộc về phương Đông, Đức Phật A Súc là chủ.<br/>2. Bảo Sinh bộ: thuộc về phương Nam, Phật Bảo Sinh là chủ.<br/>3. Phật bộ: thuộc về chính giữa, Phật Thích Ca Mâu Ni là chủ.<br/>4. Liên Hoa bộ: thuộc về phương Tây, Phật A Di Đà là chủ.<br/>5. Nghiệp bộ: thuộc về phương bắc, Phật Thành Tựu là chủ (có vô số Phật nhưng ở chính giữa Phật Thích Ca đại diện trong thời gian này, ban đầu là Phật Tỳ Lô).<br/>Nếu trên thế gian này không còn người nào tụng Chú Lăng Nghiêm, thì Ma Vương sẽ xuất hiện, chúng ma chưa thể dụng phép thần thông phá hoại nhân gian một cách tự do được chính là vì điều này. Nếu còn một người trì tụng, thì thiên ma Ba Tuần không dám xuất hiện. Vì chúng sợ nhất là Chú Lăng Nghiêm. Chúng muốn tiêu diệt nhất là Chú Lăng Nghiêm. Khi Phật pháp bắt đầu hoại diệt, thì Chú Lăng Nghiêm sẽ mất trước nhất, kể cả kinh Lăng Nghiêm. Lúc đó thiên ma Ba Tuần sẽ có thể xuất hiện hoành hành đầy rẫy khắp nơi như trong kinh đã nói. Lúc ấy sẽ không còn trời đất, không có Phật, chúng tuyệt đối chẳng sợ gì. Mỗi người Phật tử, (tại gia, và xuất gia) học thuộc lòng Chú Lăng Nghiêm và trì tụng mỗi ngày, mở nhạc tụng, hoặc in ấn tống lưu hành rộng lớn để không bị thất truyền, đây chính là hộ pháp, và khiến cho Phật pháp tồn tại lâu dài, đừng xem thường không có ý nghĩa và quan hệ gì. Hiện tại ở đây chỉ có mấy chục người nghe giảng Chú Lăng Nghiêm, nhưng chính mấy chục người này đã giữ chân bọn thiên ma, khiến chúng hoảng sợ khi đề cập đến Chú này.<br/>Hán Dịch:  Sa-môn Bát-thích-mật-đế người Trung Thiên Trúc, dịch vào đời Đường.<br/>Tuyên Hóa Thượng Nhân, Vạn Phật Thánh Thành, Bắc Mỹ Châu Hoa Kỳ lược giảng.<br/>Việt Dịch: Sa-môn Thích Minh Định",
	  "parts": [
		{
			"stt": 1,
			"tit": "Tập Một-1-Chú Lăng Nghiêm Giảng Giải 01-34",
			"dur": "31:25",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-01-Tuan-Anh-Thanh-Hong-01-34"
			]
		},
		{
			"stt": 2,
			"tit": "Tập Một-2-Chú Lăng Nghiêm Giảng Giải 34-50",
			"dur": "25:56",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-02-Tuan-Anh-34-50"
			]
		},
		{
			"stt": 3,
			"tit": "Tập Một-3-Chú Lăng Nghiêm Giảng Giải 51-67",
			"dur": "29:55",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-03-Tran-Vu-51-67"
			]
		},
		{
			"stt": 4,
			"tit": "Tập Một-4-Chú Lăng Nghiêm Giảng Giải 67-84",
			"dur": "31:57",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-04-Kieu-Hanh-67-84"
			]
		},
		{
			"stt": 5,
			"tit": "Tập Một-5-Chú Lăng Nghiêm Giảng Giải 85-98",
			"dur": "22:29",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-05-Tran-Vu-85-98"
			]
		},
		{
			"stt": 6,
			"tit": "Tập Một-6-Chú Lăng Nghiêm Giảng Giải 99-115",
			"dur": "26:46",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-06-Ngoc-Chau-99-115"
			]
		},
		{
			"stt": 7,
			"tit": "Tập Một-7-Chú Lăng Nghiêm Giảng Giải 116-137",
			"dur": "35:06",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-07-Kieu-Hanh-116-137"
			]
		},
		{
			"stt": 8,
			"tit": "Tập Một-8-Chú Lăng Nghiêm Giảng Giải 137-160",
			"dur": "38:21",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-08-Ngoc-Chau-137-160"
			]
		},
		{
			"stt": 9,
			"tit": "Tập Một-9-Chú Lăng Nghiêm Giảng Giải 160 (Hết tập 1)",
			"dur": "48:23",
			"url": [
				"1/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-1-09-Tuan-Anh-160-Het-Tap-I"
			]
		},
		{
			"stt": 10,
			"tit": "Tập Hai-1-Chú Lăng Nghiêm Giảng Giải tập 2A",
			"dur": "29:59",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-01-Tran-Vu-Ngoc-Chau-1-25"
			]
		},
		{
			"stt": 11,
			"tit": "Tập Hai-2-Chú Lăng Nghiêm Giảng Giải tập 2B",
			"dur": "34:37",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-02-Nam-Mo-Ba-Gia-Ba-De-T-Anh-25-47"
			]
		},
		{
			"stt": 12,
			"tit": "Tập Hai-3-Chú Lăng Nghiêm Giảng Giải tập 2C",
			"dur": "24:13",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-03-Xa-Ke-Da-Mau-Na-Due-Ngoc-Chau-47-60"
			]
		},
		{
			"stt": 13,
			"tit": "Tập Hai-4-Chú Lăng Nghiêm Giảng Giải tập 2D",
			"dur": "32:46",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-04-Lat-Dat-Na-Ke-T-Anh-60-81"
			]
		},
		{
			"stt": 14,
			"tit": "Tập Hai-5-Chú Lăng Nghiêm Giảng Giải tập 2E",
			"dur": "29:02",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-05-Tat-La-Ba-Thanh-Hong-80-99"
			]
		},
		{
			"stt": 15,
			"tit": "Tập Hai-6-Chú Lăng Nghiêm Giảng Giải tập 2F",
			"dur": "32:34",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-06-Ninh-Yet-Li-K-Hanh-99-118"
			]
		},
		{
			"stt": 16,
			"tit": "Tập Hai-7-Chú Lăng Nghiêm Giảng Giải tập 2G",
			"dur": "32:22",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-07-Gia-Do-La-T-Anh-118-138"
			]
		},
		{
			"stt": 17,
			"tit": "Tập Hai-8-Chú Lăng Nghiêm Giảng Giải tập 2H",
			"dur": "32:20",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-08-Ho-Lam-Dot-Tat-Phap-K-Hanh-138-158"
			]
		},
		{
			"stt": 18,
			"tit": "Tập Hai-9-Chú Lăng Nghiêm Giảng Giải tập 2I",
			"dur": "22:31",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-09-A-Li-Gia-Da-La-T-Vu-159-173"
			]
		},
		{
			"stt": 19,
			"tit": "Tập Hai-10-Chú Lăng Nghiêm Giảng Giải tập 2J",
			"dur": "24:28",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-10-A-Li-Gia-Da-La-H-Ho-191-209"
			]
		},
		{
			"stt": 20,
			"tit": "Tập Hai-11-Chú Lăng Nghiêm Giảng Giải tập 2K",
			"dur": "32:42",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-11-Ma-Li-Ca-K-Hanh-210-230"
			]
		},
		{
			"stt": 21,
			"tit": "Tập Hai-12-Chú Lăng Nghiêm Giảng Giải tập 2L (Hết tập 2)",
			"dur": "36:52",
			"url": [
				"2/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-2-12-Thue-Da-Gia-T-Anh-230-Het"
			]
		},
		{
			"stt": 22,
			"tit": "Tập Ba-1-Chú Lăng Nghiêm Giảng Giải tập 3A",
			"dur": "28:54",
			"url": [
				"3/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-3-01-O-Hong-Trang-20"
			]
		},
		{
			"stt": 23,
			"tit": "Tập Ba-2-Chú Lăng Nghiêm Giảng Giải tập 3B",
			"dur": "39:50",
			"url": [
				"3/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-3-02-Ho-Hong-Do-Lo-Ung-Trang-20-42"
			]
		},
		{
			"stt": 24,
			"tit": "Tập Ba-3-Chú Lăng Nghiêm Giảng Giải tập 3C",
			"dur": "28:22",
			"url": [
				"3/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-3-03-Sa-Ha-Tat-Ra-Nam-Trang-42-56"
			]
		},
		{
			"stt": 25,
			"tit": "Tập Ba-4-Chú Lăng Nghiêm Giảng Giải tập 3D",
			"dur": "26:59",
			"url": [
				"3/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-3-04-Tat-Dat-Tha-Trang-56-69"
			]
		},
		{
			"stt": 26,
			"tit": "Tập Ba-5-Chú Lăng Nghiêm Giảng Giải tập 3E (Hết tập 3)",
			"dur": "28:34",
			"url": [
				"3/Sach-Noi-Audio-Book-Chu-Lang-Nghiem-Giang-Giai-3-05-Tra-Tra-Anh-Ca-Trang-69-Het-Tap-03"
			]
		}
	]},
	
	{
	  "title": "Kinh Bát Nhã Ba La Mật - Giảng giải",
	  "eTitle": "Kinh Bát Nhã Ba La Mật - Giảng giải",
	  "author": "Hòa thượng Tuyên Hóa thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Huy Hồ, Nam Trung, Tuấn Anh",
	  "cover": "https://nhasachthanhduy.com/wp-content/uploads/2023/06/Kinh-Ma-Ha-Bat-Nha-01.jpg",
	  "ssrc": [		"https://phatphapungdung.com/sach-noi/bat-nha-tam-kinh-giang-thuat-sach-noi-36932.html",		"https://kinhbatnhabalamat.blogspot.com/"
	  ],
	  "grp": ["BUD.KBNTKG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/BatNhaTamKinhGiangThuat/Sach-Noi-Audio-Book-Bat-Nha-Tam-Kinh-Giang-Thuat-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		]
	  },
	  "year": "",
	  "intro": "Nói đến Phật giáo Đại thừa là nói đến Bát nhã. Vì, không có Bát nhã, là không có Phật giáo Đại thừa. Bát nhã là đầu mối, là mạch nguồn từ đó các trào lưu tư tưởng Đại thừa kể cả Mật giáo dậy khởi.<br/>Bát Nhã Ba La Mật Đa Tâm Kinh (Prajnaparamitahridaya Sutra) là một trong các kinh căn bản và phổ thông của Phật Giáo Đại Thừa. Bài kinh nầy là một trong các bài kinh của bộ Bát Nhã kết tập tại Ấn Độ qua bảy thế kỷ, từ năm 100 T.C.N. đến 600 C.N. Khi được truyền sang Trung Hoa, Tâm Kinh đã được nhiều vị cao tăng chuyển dịch từ tiếng Phạn sang tiếng Hán: ngài Cưu Ma La Thập dịch vào khoảng năm 402-412 C.N., ngài Huyền Trang dịch năm 649 C.N., ngài Nghĩa Huyền (700 C.N.), ngài Pháp Nguyệt (732 C.N.), ngài Bát Nhã và Lợi Ngôn (790 C.N.), ngài Trí Tuệ Luận (850 C.N.), ngài Pháp Thành (856 C.N.) và ngài Thi Hộ (980 C.N.). Trong các bản dịch nầy, bản dịch của ngài Huyền Trang là phổ thông nhất.Riêng tại Việt Nam, bản dịch của ngài Huyền Trang được chuyển sang chữ quốc ngữ Hán Việt và thường dùng để trì tụng hằng ngày.<br/>Quý vị cao tăng cũng có phát hành nhiều sách để giải thích nghĩa kinh, trong đó các sách của quý Hòa thượng Thích Thiện Hoa, Thích Thanh Từ, và Thích Nhất Hạnh là phổ thông nhất.<br/>Hán Dịch kinh văn: Hậu Tần Cưu Ma La Thập dịch.<br/>Việt dịch kinh văn: Hòa thượng Thích Trí Tịnh.<br/>Tuyên Hóa Thượng Nhân lược giảng.<br/>Việt dịch bài giảng: Vạn Phật Thánh Thành",
	"parts": [
	  {
		"stt": 1,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 1",
		"dur": "20:47",
		"url": [""]
	  },
	  {
		"stt": 2,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 2",
		"dur": "25:41",
		"url": [""]
	  },
	  {
		"stt": 3,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 3",
		"dur": "27:23",
		"url": [""]
	  },
	  {
		"stt": 4,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 4",
		"dur": "27:26",
		"url": [""]
	  },
	  {
		"stt": 5,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 5",
		"dur": "25:10",
		"url": [""]
	  },
	  {
		"stt": 6,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 6",
		"dur": "27:27",
		"url": [""]
	  },
	  {
		"stt": 7,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 7",
		"dur": "22:47",
		"url": [""]
	  },
	  {
		"stt": 8,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 8",
		"dur": "21:30",
		"url": [""]
	  },
	  {
		"stt": 9,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 9",
		"dur": "20:59",
		"url": [""]
	  },
	  {
		"stt": 10,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 10",
		"dur": "23:40",
		"url": [""]
	  },
	  {
		"stt": 11,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 11",
		"dur": "22:37",
		"url": [""]
	  },
	  {
		"stt": 12,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 12",
		"dur": "24:11",
		"url": [""]
	  },
	  {
		"stt": 13,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 13",
		"dur": "26:02",
		"url": [""]
	  },
	  {
		"stt": 14,
		"tit": "Bát Nhã Tâm Kinh giảng thuật 14-Hết",
		"dur": "24:32",
		"url": [""]
	  }
	]},
	
	{
	  "title": "Kinh Đại Phương Quảng Phật Hoa Nghiêm - Giảng giải",
	  "eTitle": "Kinh Đại Phương Quảng Phật Hoa Nghiêm - Giảng giải",
	  "author": "Hòa thượng Thích Trí Tịnh thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Đức Uy, Kim Phượng, Thy Mai, Huy Hồ",
	  "cover": "https://blogger.googleusercontent.com/img/a/AVvXsEhYfzXjkdr0-hO_jKoargq3Sa2RkK1SlHgBELA0LepufvVyqDf6chSXuoqu3aDt99AYe74JTy6sCJsWUulKBUZReqcZ1wthAAu3DCWOZfBMjwis39VNI_wDI9DoGA5mbzLdfHvFUzkvK2d5afiabqgreJ2ElAR9Ym3NJ109QyEiWJKUCqgveydr9F1KDw=s512",
	  "ssrc": [		"https://phatphapungdung.com/sach-noi/kinh-hoa-nghiem-sach-noi-kinh-doc-37185.html",
	  "https://gianggiaikinhhoanghiem.blogspot.com/"
	  ],
	  "grp": ["BUD.KHNG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/KinhHoaNghiem/Sach-Noi-Audio-Book-Kinh-Hoa-Nghiem-Tap-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		]
	  },
	  "year": "",
	  "tap": [
		  {"label": "Hội thứ nhất tại Bồ Ðề Ðạo Tràng" , "f": 1, "t": 15},
		  {"label": "Hội thứ nhì ở tại Ðiện Phổ Quang Minh" , "f": 16, "t": 22	},
		  {"label": "Hội thứ ba ở tại Ðiện Diệu Thắng trên cung trời Ðao Lợi" , "f": 23, "t": 28},
		  {"label": "Hội thứ tư ở tại Ðiện Bảo Trang Nghiêm, cung trời Dạ Ma" , "f": 29, "t": 32},
		  {"label": "Hội thứ năm ở tại Ðiện Nhất Thiết Diệu Bảo Trang Nghiêm, cung trời Ðâu Suất" , "f": 33, "t": 49},
		  {"label": "Hội thứ sáu ở tại Ðiện Ma Ni Bảo Tạng, cung trời Tha Hoá Tự Tại" , "f": 50, "t": 57},
		  {"label": "Hội thứ bảy ở tại Ðiện Phổ Quang Minh, Bồ tát Phổ Nhãn hỏi Phật" , "f": 58, "t": 75},
		  {"label": "Hội thứ tám tại Ðiện Phổ Quang Minh, Bồ tát Phổ Huệ hỏi Phật" , "f": 76, "t": 85},
		  {"label": "Hội thứ chín ở tại Rừng Thệ Ða" , "f": 86, "t": 117}
		],
	  "intro": "<b>Kinh Đại Phương Quảng Phật Hoa Nghiêm</b> (zh. 大方廣佛華嚴經, sa. Mahāvaipulya Buddhāvataṃsaka Sūtra, ja. Daihō Kōbutsu Kegonkyō), thường được gọi tắt là kinh Hoa Nghiêm (sa. Avataṃsakasūtra) là một kinh điển Đại thừa. Kinh Hoa Nghiêm được đánh giá là kinh điển đồ sồ nhất và dài nhất trong số các kinh của Phật giáo, theo nhận xét của dịch giả Thomas Cleary thì kinh này là <i>hoành tráng nhất, toàn thiện nhất và cấu tứ thẩm mỹ nhất trong số tất cả kinh điển Phật giáo</i>.<br/>Kinh Đại Phương Quảng Phật Hoa Nghiêm thuộc dòng Phương Quảng trong mười hai bộ kinh. Tương truyền kinh này gồm ba bản do mỗi thân Phật trong Tam thân Phật thuyết và được cất giữ ở Long Cung (cung loài Naga). Sau này, chỉ có bản kinh của Ứng thân (Phật Thích-ca Mâu-ni) được truyền lên nhân gian. Kinh này gồm 40 phẩm trải đều 81 quyển (Hán bản) trong đó quan trọng nhất là phẩm Nhập Pháp giới (phẩm 39) và phẩm Nhập Bất Tư Nghì Giải Thoát Cảnh Giới Phổ Hiền Hạnh Nguyện (phẩm 40, là một trong năm kinh điển căn bản của Tịnh Độ tông). Kinh Hoa Nghiêm được xem là kinh điển quan trọng nhất của Hoa Nghiêm tông.<br/>Bộ Kinh Hoa Nghiêm này còn gọi là Kinh Pháp Giới, cũng gọi là Kinh Hư Không, tận hư không khắp pháp giới, chẳng có một nơi nào mà chẳng có Kinh Hoa Nghiêm ở đó. Chỗ ở của Kinh Hoa Nghiêm tức cũng là chỗ ở của Phật, cũng là chỗ ở của Pháp, cũng là chỗ ở của Hiền Thánh Tăng. Cho nên khi Phật vừa mới thành chánh giác, thì nói bộ Kinh Hoa Nghiêm nầy, để giáo hoá tất cả pháp thân Ðại Sĩ. Vì bộ Kinh nầy là Kinh vi diệu không thể nghĩ bàn, do đó bộ Kinh nầy được bảo tồn ở dưới Long cung, do Long Vương bảo hộ giữ gìn. Về sau do Ngài Bồ Tát Long Thọ, xuống dưới Long cung đọc thuộc lòng và ghi nhớ bộ Kinh nầy, sau đó lưu truyền trên thế gian.<br/>Hán dịch: Sa Môn Thật Xoa Nan Đà.<br/>Việt dịch: Hòa thượng Thích Trí Tịnh.",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Tập 1.01. Lời Nói Đầu",
		"dur": "10:12",
		"url": ["1-01-Loi-Noi-Dau"]
	  },
	  {
		"stt": 2,
		"tit": "Tập 1.02. Phẩm Thế Chủ Diệu Nghiêm 1",
		"dur": "27:15",
		"url": ["1-02-Pham-The-Chu-Dieu-Nghiem-1"]
	  },
	  {
		"stt": 3,
		"tit": "Tập 1.03. Phẩm Thế Chủ Diệu Nghiêm 2",
		"dur": "33:20",
		"url": ["1-03-Pham-The-Chu-Dieu-Nghiem-2"]
	  },
	  {
		"stt": 4,
		"tit": "Tập 1.04. Phẩm Thế Chủ Diệu Nghiêm 3",
		"dur": "27:35",
		"url": ["1-04-Pham-The-Chu-Dieu-Nghiem-3"]
	  },
	  {
		"stt": 5,
		"tit": "Tập 1.05. Phẩm Thế Chủ Diệu Nghiêm 4",
		"dur": "26:34",
		"url": ["1-05-Pham-The-Chu-Dieu-Nghiem-4"]
	  },
	  {
		"stt": 6,
		"tit": "Tập 1.06. Phẩm Thế Chủ Diệu Nghiêm 5",
		"dur": "24:27",
		"url": ["1-06-Pham-The-Chu-Dieu-Nghiem-5"]
	  },
	  {
		"stt": 7,
		"tit": "Tập 1.07. Phẩm Thế Chủ Diệu Nghiêm 6",
		"dur": "22:46",
		"url": ["1-07-Pham-The-Chu-Dieu-Nghiem-6"]
	  },
	  {
		"stt": 8,
		"tit": "Tập 1.08. Phẩm Như Lai Hiện Tướng 1",
		"dur": "27:35",
		"url": ["1-08-Pham-Nhu-Lai-Hien-Tuong-1"]
	  },
	  {
		"stt": 9,
		"tit": "Tập 1.09. Phẩm Như Lai Hiện Tướng 2",
		"dur": "19:36",
		"url": ["1-09-Pham-Nhu-Lai-Hien-Tuong-2"]
	  },
	  {
		"stt": 10,
		"tit": "Tập 1.10. Phẩm Phổ Hiền Tam Muội",
		"dur": "11:16",
		"url": ["1-10-Pham-Pho-Hien-Tam-Muoi"]
	  },
	  {
		"stt": 11,
		"tit": "Tập 1.11. Phẩm Thế Giới Thành Tựu",
		"dur": "34:06",
		"url": ["1-11-Pham-The-Gioi-Thanh-Tuu"]
	  },
	  {
		"stt": 12,
		"tit": "Tập 1.12. Phẩm Hoa Tạng Thế Giới 1",
		"dur": "34:30",
		"url": ["1-12-Pham-Hoa-Tang-The-Gioi-1"]
	  },
	  {
		"stt": 13,
		"tit": "Tập 1.13. Phẩm Hoa Tạng Thế Giới 2",
		"dur": "33:57",
		"url": ["1-13-Pham-Hoa-Tang-The-Gioi-2"]
	  },
	  {
		"stt": 14,
		"tit": "Tập 1.14. Phẩm Hoa Tạng Thế Giới 3",
		"dur": "30:18",
		"url": ["1-14-Pham-Hoa-Tang-The-Gioi-3"]
	  },
	  {
		"stt": 15,
		"tit": "Tập 1.15. Phẩm Tỳ Lô Giá Na",
		"dur": "26:11",
		"url": ["1-15-Pham-Ty-Lo-Gia-Na"]
	  },
	  {
		"stt": 16,
		"tit": "Tập 1.16. Phẩm Như Lai Danh Hiệu",
		"dur": "16:21",
		"url": ["1-16-Pham-Nhu-Lai-Danh-Hieu"]
	  },
	  {
		"stt": 17,
		"tit": "Tập 1.17. Phẩm Tứ Thánh Đế",
		"dur": "16:10",
		"url": ["1-17-Pham-Tu-Thanh-De"]
	  },
	  {
		"stt": 18,
		"tit": "Tập 1.18. Phẩm Quang Minh Giác",
		"dur": "22:51",
		"url": ["1-18-Pham-Quang-Minh-Giac"]
	  },
	  {
		"stt": 19,
		"tit": "Tập 1.19. Phẩm Bồ Tát Văn Minh",
		"dur": "21:58",
		"url": ["1-19-Pham-Bo-Tat-Van-Minh"]
	  },
	  {
		"stt": 20,
		"tit": "Tập 1.20. Phẩm Tịnh Hạnh",
		"dur": "18:07",
		"url": ["1-20-Pham-Tinh-Hanh"]
	  },
	  {
		"stt": 21,
		"tit": "Tập 1.21. Phẩm Hiền Thủ 1",
		"dur": "30:19",
		"url": ["1-21-Pham-Hien-Thu-1"]
	  },
	  {
		"stt": 22,
		"tit": "Tập 1.22. Phẩm Hiền Thủ 2",
		"dur": "34:45",
		"url": ["1-22-Pham-Hien-Thu-2"]
	  },
	  {
		"stt": 23,
		"tit": "Tập 1.23. Phẩm Thắng Tu Di Sơn Danh",
		"dur": "04:33",
		"url": ["1-23-Pham-Thang-Tu-Di-Son-Danh"]
	  },
	  {
		"stt": 24,
		"tit": "Tập 1.24. Phẩm Tu Di Đảnh Lễ Tán",
		"dur": "18:03",
		"url": ["1-24-Pham-Tu-Di-Danh-Le-Tan"]
	  },
	  {
		"stt": 25,
		"tit": "Tập 1.25. Phẩm Thập Trụ",
		"dur": "34:36",
		"url": ["1-25-Pham-Thap-Tru"]
	  },
	  {
		"stt": 26,
		"tit": "Tập 1.26. Phẩm Phạm Hạnh",
		"dur": "05:21",
		"url": ["1-26-Pham-Pham-Hanh"]
	  },
	  {
		"stt": 27,
		"tit": "Tập 1.27. Phẩm Sơ Phát Tâm Công Đức",
		"dur": "37:46",
		"url": ["1-27-Pham-So-Phat-Tam-Cong-Duc"]
	  },
	  {
		"stt": 28,
		"tit": "Tập 1.28. Phẩm Minh Pháp",
		"dur": "32:43",
		"url": ["1-28-Pham-Minh-Phap"]
	  },
	  {
		"stt": 29,
		"tit": "Tập 1.29. Phẩm Thăng Dạ Ma Thiên Cung",
		"dur": "04:18",
		"url": ["1-29-Pham-Thang-Da-Ma-Thien-Cung"]
	  },
	  {
		"stt": 30,
		"tit": "Tập 1.30. Phẩm Đạ Ma Cung Kệ Tán",
		"dur": "13:40",
		"url": ["1-30-Pham-Da-Ma-Cung-Ke-Tan"]
	  },
	  {
		"stt": 31,
		"tit": "Tập 1.31. Phẩm Thập Hạnh 1",
		"dur": "21:14",
		"url": ["1-31-Pham-Thap-Hanh-1"]
	  },
	  {
		"stt": 32,
		"tit": "Tập 1.32. Phẩm Thập Hạnh 2 {hết tập 1}",
		"dur": "36:59",
		"url": ["1-32-Pham-Thap-Hanh-2-Het-Tap-1"]
	  },
	  {
		"stt": 33,
		"tit": "Tập 2.01. Phẩm Vô Tận Tạng",
		"dur": "27:04",
		"url": ["2-01-Pham-Vo-Tan-Tang"]
	  },
	  {
		"stt": 34,
		"tit": "Tập 2.02. Phẩm Thăng Đâu Suất Thiên Cung",
		"dur": "35:41",
		"url": ["2-02-Pham-Thang-Dau-Suat-Thien-Cung"]
	  },
	  {
		"stt": 35,
		"tit": "Tập 2.03. Phẩm Đâu Suất Kệ Tán",
		"dur": "19:33",
		"url": ["2-03-Pham-Dau-Suat-Ke-Tan"]
	  },
	  {
		"stt": 36,
		"tit": "Tập 2.04. Phẩm Thập Hồi Hướng 1",
		"dur": "32:09",
		"url": ["2-04-Pham-Thap-Hoi-Huong-1"]
	  },
	  {
		"stt": 37,
		"tit": "Tập 2.05. Phẩm Thập Hồi Hướng 2",
		"dur": "31:01",
		"url": ["2-05-Pham-Thap-Hoi-Huong-2"]
	  },
	  {
		"stt": 38,
		"tit": "Tập 2.06. Phẩm Thập Hồi Hướng 3",
		"dur": "30:14",
		"url": ["2-06-Pham-Thap-Hoi-Huong-3"]
	  },
	  {
		"stt": 39,
		"tit": "Tập 2.07. Phẩm Thập Hồi Hướng 4",
		"dur": "28:13",
		"url": ["2-07-Pham-Thap-Hoi-Huong-4"]
	  },
	  {
		"stt": 40,
		"tit": "Tập 2.08. Phẩm Thập Hồi Hướng 5",
		"dur": "29:35",
		"url": ["2-08-Pham-Thap-Hoi-Huong-5"]
	  },
	  {
		"stt": 41,
		"tit": "Tập 2.09. Phẩm Thập Hồi Hướng 6",
		"dur": "22:59",
		"url": ["2-09-Pham-Thap-Hoi-Huong-6"]
	  },
	  {
		"stt": 42,
		"tit": "Tập 2.10. Phẩm Thập Hồi Hướng 7",
		"dur": "33:42",
		"url": ["2-10-Pham-Thap-Hoi-Huong-7"]
	  },
	  {
		"stt": 43,
		"tit": "Tập 2.11. Phẩm Thập Hồi Hướng 8",
		"dur": "24:57",
		"url": ["2-11-Pham-Thap-Hoi-Huong-8"]
	  },
	  {
		"stt": 44,
		"tit": "Tập 2.12. Phẩm Thập Hồi Hướng 9",
		"dur": "25:10",
		"url": ["2-12-Pham-Thap-Hoi-Huong-9"]
	  },
	  {
		"stt": 45,
		"tit": "Tập 2.13. Phẩm Thập Hồi Hướng 10",
		"dur": "29:40",
		"url": ["2-13-Pham-Thap-Hoi-Huong-10"]
	  },
	  {
		"stt": 46,
		"tit": "Tập 2.14. Phẩm Thập Hồi Hướng 11",
		"dur": "30:56",
		"url": ["2-14-Pham-Thap-Hoi-Huong-11"]
	  },
	  {
		"stt": 47,
		"tit": "Tập 2.15. Phẩm Thập Hồi Hướng 12",
		"dur": "23:32",
		"url": ["2-15-Pham-Thap-Hoi-Huong-12"]
	  },
	  {
		"stt": 48,
		"tit": "Tập 2.16. Phẩm Thập Hồi Hướng 13",
		"dur": "23:36",
		"url": ["2-16-Pham-Thap-Hoi-Huong-13"]
	  },
	  {
		"stt": 49,
		"tit": "Tập 2.17. Phẩm Thập Hồi Hướng 14",
		"dur": "34:26",
		"url": ["2-17-Pham-Thap-Hoi-Huong-14"]
	  },
	  {
		"stt": 50,
		"tit": "Tập 2.18. Phẩm Thập Địa 1",
		"dur": "33:35",
		"url": ["2-18-Pham-Thap-Dia-1"]
	  },
	  {
		"stt": 51,
		"tit": "Tập 2.19. Phẩm Thập Địa 2",
		"dur": "25:56",
		"url": ["2-19-Pham-Thap-Dia-2"]
	  },
	  {
		"stt": 52,
		"tit": "Tập 2.20. Phẩm Thập Địa 3",
		"dur": "28:18",
		"url": ["2-20-Pham-Thap-Dia-3"]
	  },
	  {
		"stt": 53,
		"tit": "Tập 2.21. Phẩm Thập Địa 4",
		"dur": "35:06",
		"url": ["2-21-Pham-Thap-Dia-4"]
	  },
	  {
		"stt": 54,
		"tit": "Tập 2.22. Phẩm Thập Địa 5",
		"dur": "39:34",
		"url": ["2-22-Pham-Thap-Dia-5"]
	  },
	  {
		"stt": 55,
		"tit": "Tập 2.23. Phẩm Thập Địa 6",
		"dur": "29:29",
		"url": ["2-23-Pham-Thap-Dia-6"]
	  },
	  {
		"stt": 56,
		"tit": "Tập 2.24. Phẩm Thập Địa 7",
		"dur": "28:15",
		"url": ["2-24-Pham-Thap-Dia-7"]
	  },
	  {
		"stt": 57,
		"tit": "Tập 2.25. Phẩm Thập Địa 8 {hết tập 2}",
		"dur": "32:08",
		"url": ["2-25-Pham-Thap-Dia-8-Het-Tap-2"]
	  },
	  {
		"stt": 58,
		"tit": "Tập 3.01. Phẩm Thập Định 1",
		"dur": "36:07",
		"url": ["3-01-Pham-Thap-Dinh-1"]
	  },
	  {
		"stt": 59,
		"tit": "Tập 3.02. Phẩm Thập Định 2",
		"dur": "30:52",
		"url": ["3-02-Pham-Thap-Dinh-2"]
	  },
	  {
		"stt": 60,
		"tit": "Tập 3.03. Phẩm Thập Định 3",
		"dur": "30:06",
		"url": ["3-03-Pham-Thap-Dinh-3"]
	  },
	  {
		"stt": 61,
		"tit": "Tập 3.04. Phẩm Thập Định 4",
		"dur": "40:14",
		"url": ["3-04-Pham-Thap-Dinh-4"]
	  },
	  {
		"stt": 62,
		"tit": "Tập 3.05. Phẩm Thập Thông",
		"dur": "22:07",
		"url": ["3-05-Pham-Thap-Thong"]
	  },
	  {
		"stt": 63,
		"tit": "Tập 3.06. Phẩm Thập Nhẫn",
		"dur": "36:55",
		"url": ["3-06-Pham-Thap-Nhan"]
	  },
	  {
		"stt": 64,
		"tit": "Tập 3.07. Phẩm A Tăng Kỳ",
		"dur": "30:09",
		"url": ["3-07-Pham-A-Tang-Ky"]
	  },
	  {
		"stt": 65,
		"tit": "Tập 3.08. Phẩm Thọ Lượng",
		"dur": "01:43",
		"url": ["3-08-Pham-Tho-Luong"]
	  },
	  {
		"stt": 66,
		"tit": "Tập 3.09. Phẩm Chư Bồ Tát Trụ Xứ",
		"dur": "04:16",
		"url": ["3-09-Pham-Chu-Bo-Tat-Tru-Xu"]
	  },
	  {
		"stt": 67,
		"tit": "Tập 3.10. Phẩm Phật Bất Tư Nghì Pháp 1",
		"dur": "37:57",
		"url": ["3-10-Pham-Phat-Bat-Tu-Nghi-Phap-1"]
	  },
	  {
		"stt": 68,
		"tit": "Tập 3.11. Phẩm Phật Bất Tư Nghì Pháp 2",
		"dur": "38:39",
		"url": ["3-11-Pham-Phat-Bat-Tu-Nghi-Phap-2"]
	  },
	  {
		"stt": 69,
		"tit": "Tập 3.12. Phẩm Như Lai Thập Thân Tướng Hải",
		"dur": "36:20",
		"url": ["3-12-Pham-Nhu-Lai-Thap-Than-Tuong-Hai"]
	  },
	  {
		"stt": 70,
		"tit": "Tập 3.13. Phẩm Như Lai Tùy Hảo Quang Minh Công Đức",
		"dur": "14:59",
		"url": ["3-13-Pham-Nhu-Lai-Tuy-Hao-Quang-Minh-Cong-Duc"]
	  },
	  {
		"stt": 71,
		"tit": "Tập 3.14. Phẩm Phổ Hiền Hạnh",
		"dur": "25:31",
		"url": ["3-14-Pham-Pho-Hien-Hanh"]
	  },
	  {
		"stt": 72,
		"tit": "Tập 3.15. Như Lai Xuất Hiện 1",
		"dur": "37:57",
		"url": ["3-15-Nhu-Lai-Xuat-Hien-1"]
	  },
	  {
		"stt": 73,
		"tit": "Tập 3.16. Như Lai Xuất Hiện 2",
		"dur": "33:05",
		"url": ["3-16-Nhu-Lai-Xuat-Hien-2"]
	  },
	  {
		"stt": 74,
		"tit": "Tập 3.17. Như Lai Xuất Hiện 3",
		"dur": "34:07",
		"url": ["3-17-Nhu-Lai-Xuat-Hien-3"]
	  },
	  {
		"stt": 75,
		"tit": "Tập 3.18. Như Lai Xuất Hiện 4",
		"dur": "44:21",
		"url": ["3-18-Nhu-Lai-Xuat-Hien-4"]
	  },
	  {
		"stt": 76,
		"tit": "Tập 3.19. Phẩm Ly Thế Gian 1",
		"dur": "30:25",
		"url": ["3-19-Pham-Ly-The-Gian-1"]
	  },
	  {
		"stt": 77,
		"tit": "Tập 3.20. Phẩm Ly Thế Gian 2",
		"dur": "30:30",
		"url": ["3-20-Pham-Ly-The-Gian-2"]
	  },
	  {
		"stt": 78,
		"tit": "Tập 3.21. Phẩm Ly Thế Gian 3",
		"dur": "29:32",
		"url": ["3-21-Pham-Ly-The-Gian-3"]
	  },
	  {
		"stt": 79,
		"tit": "Tập 3.22. Phẩm Ly Thế Gian 4",
		"dur": "21:13",
		"url": ["3-22-Pham-Ly-The-Gian-4"]
	  },
	  {
		"stt": 80,
		"tit": "Tập 3.23. Phẩm Ly Thế Gian 5",
		"dur": "29:35",
		"url": ["3-23-Pham-Ly-The-Gian-5"]
	  },
	  {
		"stt": 81,
		"tit": "Tập 3.24. Phẩm Ly Thế Gian 6",
		"dur": "28:55",
		"url": ["3-24-Pham-Ly-The-Gian-6"]
	  },
	  {
		"stt": 82,
		"tit": "Tập 3.25. Phẩm Ly Thế Gian 7",
		"dur": "35:04",
		"url": ["3-25-Pham-Ly-The-Gian-7"]
	  },
	  {
		"stt": 83,
		"tit": "Tập 3.26. Phẩm Ly Thế Gian 8",
		"dur": "33:34",
		"url": ["3-26-Pham-Ly-The-Gian-8"]
	  },
	  {
		"stt": 84,
		"tit": "Tập 3.27. Phẩm Ly Thế Gian 9",
		"dur": "31:08",
		"url": ["3-27-Pham-Ly-The-Gian-9"]
	  },
	  {
		"stt": 85,
		"tit": "Tập 3.28. Phẩm Ly Thế Gian 10 {hết tập 3}",
		"dur": "32:16",
		"url": ["3-28-Pham-Ly-The-Gian-10-Het-Tap-3"]
	  },
	  {
		"stt": 86,
		"tit": "Tập 4.01. Phẩm Nhập Pháp Giới 1",
		"dur": "31:24",
		"url": ["4-01-Pham-Nhap-Phap-Gioi-1"]
	  },
	  {
		"stt": 87,
		"tit": "Tập 4.02. Phẩm Nhập Pháp Giới 2",
		"dur": "27:12",
		"url": ["4-02-Pham-Nhap-Phap-Gioi-2"]
	  },
	  {
		"stt": 88,
		"tit": "Tập 4.03. Phẩm Nhập Pháp Giới 3",
		"dur": "33:59",
		"url": ["4-03-Pham-Nhap-Phap-Gioi-3"]
	  },
	  {
		"stt": 89,
		"tit": "Tập 4.04. Phẩm Nhập Pháp Giới 4",
		"dur": "35:48",
		"url": ["4-04-Pham-Nhap-Phap-Gioi-4"]
	  },
	  {
		"stt": 90,
		"tit": "Tập 4.05. Phẩm Nhập Pháp Giới 5",
		"dur": "27:58",
		"url": ["4-05-Pham-Nhap-Phap-Gioi-5"]
	  },
	  {
		"stt": 91,
		"tit": "Tập 4.06. Phẩm Nhập Pháp Giới 6",
		"dur": "26:30",
		"url": ["4-06-Pham-Nhap-Phap-Gioi-6"]
	  },
	  {
		"stt": 92,
		"tit": "Tập 4.07. Phẩm Nhập Pháp Giới 7",
		"dur": "27:54",
		"url": ["4-07-Pham-Nhap-Phap-Gioi-7"]
	  },
	  {
		"stt": 93,
		"tit": "Tập 4.08. Phẩm Nhập Pháp Giới 8",
		"dur": "28:44",
		"url": ["4-08-Pham-Nhap-Phap-Gioi-8"]
	  },
	  {
		"stt": 94,
		"tit": "Tập 4.09. Phẩm Nhập Pháp Giới 9",
		"dur": "21:22",
		"url": ["4-09-Pham-Nhap-Phap-Gioi-9"]
	  },
	  {
		"stt": 95,
		"tit": "Tập 4.10. Phẩm Nhập Pháp Giới 10",
		"dur": "30:30",
		"url": ["4-10-Pham-Nhap-Phap-Gioi-10"]
	  },
	  {
		"stt": 96,
		"tit": "Tập 4.11. Phẩm Nhập Pháp Giới 11",
		"dur": "30:29",
		"url": ["4-11-Pham-Nhap-Phap-Gioi-11"]
	  },
	  {
		"stt": 97,
		"tit": "Tập 4.12. Phẩm Nhập Pháp Giới 12",
		"dur": "27:51",
		"url": ["4-12-Pham-Nhap-Phap-Gioi-12"]
	  },
	  {
		"stt": 98,
		"tit": "Tập 4.13. Phẩm Nhập Pháp Giới 13",
		"dur": "34:02",
		"url": ["4-13-Pham-Nhap-Phap-Gioi-13"]
	  },
	  {
		"stt": 99,
		"tit": "Tập 4.14. Phẩm Nhập Pháp Giới 14",
		"dur": "36:16",
		"url": ["4-14-Pham-Nhap-Phap-Gioi-14"]
	  },
	  {
		"stt": 100,
		"tit": "Tập 4.15. Phẩm Nhập Pháp Giới 15",
		"dur": "31:20",
		"url": ["4-15-Pham-Nhap-Phap-Gioi-15"]
	  },
	  {
		"stt": 101,
		"tit": "Tập 4.16. Phẩm Nhập Pháp Giới 16",
		"dur": "32:23",
		"url": ["4-16-Pham-Nhap-Phap-Gioi-16"]
	  },
	  {
		"stt": 102,
		"tit": "Tập 4.17. Phẩm Nhập Pháp Giới 17",
		"dur": "19:50",
		"url": ["4-17-Pham-Nhap-Phap-Gioi-17"]
	  },
	  {
		"stt": 103,
		"tit": "Tập 4.18. Phẩm Nhập Pháp Giới Phần Sau 1",
		"dur": "25:48",
		"url": ["4-18-Pham-Nhap-Phap-Gioi-Phan-Sau-1"]
	  },
	  {
		"stt": 104,
		"tit": "Tập 4.19. Phẩm Nhập Pháp Giới Phần Sau 2",
		"dur": "30:46",
		"url": ["4-19-Pham-Nhap-Phap-Gioi-Phan-Sau-2"]
	  },
	  {
		"stt": 105,
		"tit": "Tập 4.20. Phẩm Nhập Pháp Giới Phần Sau 3",
		"dur": "33:28",
		"url": ["4-20-Pham-Nhap-Phap-Gioi-Phan-Sau-3"]
	  },
	  {
		"stt": 106,
		"tit": "Tập 4.21. Phẩm Nhập Pháp Giới Phần Sau 4",
		"dur": "37:43",
		"url": ["4-21-Pham-Nhap-Phap-Gioi-Phan-Sau-4"]
	  },
	  {
		"stt": 107,
		"tit": "Tập 4.22. Phẩm Nhập Pháp Giới Phần Sau 5",
		"dur": "33:07",
		"url": ["4-22-Pham-Nhap-Phap-Gioi-Phan-Sau-5"]
	  },
	  {
		"stt": 108,
		"tit": "Tập 4.23. Phẩm Nhập Pháp Giới Phần Sau 6",
		"dur": "29:13",
		"url": ["4-23-Pham-Nhap-Phap-Gioi-Phan-Sau-6"]
	  },
	  {
		"stt": 109,
		"tit": "Tập 4.24. Phẩm Nhập Pháp Giới Phần Sau 7",
		"dur": "36:07",
		"url": ["4-24-Pham-Nhap-Phap-Gioi-Phan-Sau-7"]
	  },
	  {
		"stt": 110,
		"tit": "Tập 4.25. Phẩm Nhập Pháp Giới Phần Sau 8",
		"dur": "32:03",
		"url": ["4-25-Pham-Nhap-Phap-Gioi-Phan-Sau-8"]
	  },
	  {
		"stt": 111,
		"tit": "Tập 4.26. Phẩm Nhập Pháp Giới Phần Sau 9",
		"dur": "36:13",
		"url": ["4-26-Pham-Nhap-Phap-Gioi-Phan-Sau-9"]
	  },
	  {
		"stt": 112,
		"tit": "Tập 4.27. Phẩm Nhập Pháp Giới Phần Sau 10",
		"dur": "26:59",
		"url": ["4-27-Pham-Nhap-Phap-Gioi-Phan-Sau-10"]
	  },
	  {
		"stt": 113,
		"tit": "Tập 4.28. Phẩm Nhập Pháp Giới Phần Sau 11",
		"dur": "26:23",
		"url": ["4-28-Pham-Nhap-Phap-Gioi-Phan-Sau-11"]
	  },
	  {
		"stt": 114,
		"tit": "Tập 4.29. Phẩm Nhập Pháp Giới Phần Sau 12",
		"dur": "35:13",
		"url": ["4-29-Pham-Nhap-Phap-Gioi-Phan-Sau-12"]
	  },
	  {
		"stt": 115,
		"tit": "Tập 4.30. Phẩm Nhập Pháp Giới Phần Sau 13",
		"dur": "30:56",
		"url": ["4-30-Pham-Nhap-Phap-Gioi-Phan-Sau-13"]
	  },
	  {
		"stt": 116,
		"tit": "Tập 4.31. Phẩm Nhập Pháp Giới Phần Sau 14",
		"dur": "31:09",
		"url": ["4-31-Pham-Nhap-Phap-Gioi-Phan-Sau-14"]
	  },
	  {
		"stt": 117,
		"tit": "Tập 4.32. Phẩm Nhập Bất Tư Nghì Giải Thoát Cảnh Giới Phổ Hiền Hạnh Nguyện {hết tập 4}",
		"dur": "33:48",
		"url": [
		  "4-32-Pham-Nhap-Bat-Tu-Nghi-Giai-Thoat-Canh-Gioi-Pho-Hien-Hanh-Nguyen-Het-Tap-4"
		]
	  }
	]},
	
	{
	  "title": "Kinh Diệu Pháp Liên Hoa - Giảng giải",
	  "eTitle": "Kinh Diệu Pháp Liên Hoa - Giảng giải",
	  "author": "Hòa thượng Tuyên Hóa thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Đức Uy, Kim Phượng, Thy Mai, Huy Hồ",
	  "cover": "https://blogger.googleusercontent.com/img/a/AVvXsEj4KDqiUD-IkdyIQy2URvLKSmB6zKbcGxjWKYkCiXgiRvnXcF5Pe1ttt0GPiK3kUC8q5PIuaFLD4XEXrOuVEj7cnkdoHkgG-zcj3Sb3oR1sI0xVccHJMf0KaDkR4WU-ok93BIwyXsyyKjxOlE_AEuKS5ZbxzdZV4ZvmjJbaD5BnbTxGGM4YBwVCTGGdng=s499",
	  "ssrc": [		"https://phatphapungdung.com/sach-noi/giang-giai-kinh-dieu-phap-lien-hoa-sach-noi-kinh-doc-37181.html",
	  "https://gianggiaikinhphaphoa.blogspot.com/"
	  ],
	  "grp": ["BUD.KDPLHG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/KinhDoc/GiangGiaiKinhDieuPhapLienHoa/Sach-Noi-Audio-Book-Giang-Giai-Kinh-Dieu-Phap-Lien-Hoa-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		]
	  },
	  "tap": [
		{"label": "Quyển I", "f": 1, "t": 25},
		{"label": "Quyển II", "f": 26, "t": 43},
		{"label": "Quyển III", "f": 44, "t": 54},
		{"label": "Quyển IV", "f": 55, "t": 69},
		{"label": "Quyển V", "f": 70, "t": 80},
		{"label": "Quyển VI", "f": 81, "t": 91},
		{"label": "Quyển VII", "f": 92, "t": 107}
	  ],
	  "year": "",
	  "intro": "<b>Kinh Diệu Pháp Liên Hoa</b> (sa. Saddharma Puṇḍarīka Sūtra, zh. 妙法蓮華經 (Miàofǎ Liánhuá jīng), ja. 妙法蓮華経 (Myōhō Renge Kyō), en. Lotus Sutra) thường gọi tắt là kinh Pháp Hoa là một trong những bộ kinh Đại thừa quan trọng nhất, được lưu truyền rộng rãi ở các nước phương Đông như Trung Hoa, Việt Nam, Nhật Bản, Hàn Quốc... Tương truyền, kinh Pháp Hoa được Phật Thích Ca Mâu Ni (Shakyamuni) thuyết giảng trên đỉnh núi Linh Thứu (Gṛdhrakūṭa) trước khi ngài nhập Bát Niết-bàn (sa. Parinivarna), tức vào chặng đường cuối của sự nghiệp hoằng hóa chúng sinh (ngũ thời giáo): Hoa Nghiêm (Avatamsaka), A-hàm (Agama), Phương Quảng (Vaipulya), Bát Nhã (Prajnãramita) và Pháp Hoa - Niết Bàn (theo quan niệm của Thiên Thai Tông).<br/>Kinh Diệu Pháp Liên Hoa (Pháp Hoa) là bộ kinh đại thừa gồm bảy quyển tổng cộng là hai mươi tám phẩm, suốt hơn sáu vạn lời, nghĩa lý sâu xa, kinh văn rộng lớn, chứa đựng tâm nguyện và phương tiện huyền diệu ngời sáng của Phật và Bồ-Tát. Tâm nguyện của Phật là tâm nguyện khắp độ chúng sanh đạt thành đạo quả giác ngộ. Bởi thế nên ngay quyển đầu của kinh về phẩm phương tiện đã nói: (Phật ra đời là vì một nhơn duyên lớn duy nhất là khai thị chúng sanh ngộ nhập tri kiến Phật). Thế nghĩa là Phật rộng mở phương tiện pháp môn, chỉ bày chơn tâm Phật tánh để chúng sanh tin tưởng khả năng thánh thiện của mình mà tiến tu đến Phật quả.<br/>Kinh Diệu Pháp Liên Hoa có tên đầy đủ là Kinh Diệu Pháp Liên Hoa Giáo Bồ-tát Pháp Phật Hộ Niệm. Trong đó, Diệu Pháp mang ý nghĩa là Tri kiến Phật có sẵn trong mỗi chúng sinh (Phật tính) còn Liên hoa (tức hoa sen) là một loài hoa mang ý nghĩa biểu tượng cho Diệu Pháp. Tri kiến Phật là Diệu Pháp vì đây là pháp vượt qua mọi pháp thế gian, không có pháp nào có thể sánh được Tri kiến Phật. Tri kiến Phật là pháp sẵn có, bất sinh - bất diệt có trong mọi chúng sinh tức mọi chúng sinh đều có Tri kiến Phật và có thể giác ngộ thành Phật. Tri kiến Phật là tư tưởng cốt lõi của kinh: nội dung kinh chủ yếu trình bày và diễn giải tư tưởng này.<br/>Hán dịch: Tam tạng Pháp sư Cưu Ma La Thập.<br/>Việt dịch: Hòa thượng Thích Trí Tịnh.",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Giải Thích Tên Kinh 1",
		"dur": "31:51",
		"url": ["01-Giai-Thich-Ten-Kinh-1"]
	  },
	  {
		"stt": 2,
		"tit": "Giải Thích Tên Kinh 2",
		"dur": "39:05",
		"url": ["02-Giai-Thich-Ten-Kinh-2"]
	  },
	  {
		"stt": 3,
		"tit": "Giải Thích Tên Kinh 3",
		"dur": "37:13",
		"url": ["03-Giai-Thich-Ten-Kinh-3"]
	  },
	  {
		"stt": 4,
		"tit": "Phẩm Tựa 1",
		"dur": "19:05",
		"url": ["04-Pham-Tua-1"]
	  },
	  {
		"stt": 5,
		"tit": "Phẩm Tựa 2",
		"dur": "26:14",
		"url": ["05-Pham-Tua-2"]
	  },
	  {
		"stt": 6,
		"tit": "Phẩm Tựa 3",
		"dur": "35:05",
		"url": ["06-Pham-Tua-3"]
	  },
	  {
		"stt": 7,
		"tit": "Phẩm Tựa 4",
		"dur": "31:24",
		"url": ["07-Pham-Tua-4"]
	  },
	  {
		"stt": 8,
		"tit": "Phẩm Tựa 5",
		"dur": "37:45",
		"url": ["08-Pham-Tua-5"]
	  },
	  {
		"stt": 9,
		"tit": "Phẩm Tựa 6",
		"dur": "32:06",
		"url": ["09-Pham-Tua-6"]
	  },
	  {
		"stt": 10,
		"tit": "Phẩm Tựa 7",
		"dur": "31:42",
		"url": ["10-Pham-Tua-7"]
	  },
	  {
		"stt": 11,
		"tit": "Phẩm Tựa 8",
		"dur": "35:42",
		"url": ["11-Pham-Tua-8"]
	  },
	  {
		"stt": 12,
		"tit": "Phẩm Tựa 9",
		"dur": "29:47",
		"url": ["12-Pham-Tua-9"]
	  },
	  {
		"stt": 13,
		"tit": "Phẩm Tựa 10",
		"dur": "30:33",
		"url": ["13-Pham-Tua-10"]
	  },
	  {
		"stt": 14,
		"tit": "Phẩm Tựa 11",
		"dur": "29:08",
		"url": ["14-Pham-Tua-11"]
	  },
	  {
		"stt": 15,
		"tit": "Phẩm Tựa 12",
		"dur": "31:04",
		"url": ["15-Pham-Tua-12"]
	  },
	  {
		"stt": 16,
		"tit": "Phẩm Phương Tiện 1",
		"dur": "29:43",
		"url": ["16-Pham-Phuong-Tien-1"]
	  },
	  {
		"stt": 17,
		"tit": "Phẩm Phương Tiện 2",
		"dur": "30:11",
		"url": ["17-Pham-Phuong-Tien-2"]
	  },
	  {
		"stt": 18,
		"tit": "Phẩm Phương Tiện 3",
		"dur": "29:46",
		"url": ["18-Pham-Phuong-Tien-3"]
	  },
	  {
		"stt": 19,
		"tit": "Phẩm Phương Tiện 4",
		"dur": "20:24",
		"url": ["19-Pham-Phuong-Tien-4"]
	  },
	  {
		"stt": 20,
		"tit": "Phẩm Phương Tiện 5",
		"dur": "19:50",
		"url": ["20-Pham-Phuong-Tien-5"]
	  },
	  {
		"stt": 21,
		"tit": "Phẩm Phương Tiện 6",
		"dur": "31:50",
		"url": ["21-Pham-Phuong-Tien-6"]
	  },
	  {
		"stt": 22,
		"tit": "Phẩm Phương Tiện 7",
		"dur": "29:28",
		"url": ["22-Pham-Phuong-Tien-7"]
	  },
	  {
		"stt": 23,
		"tit": "Phẩm Phương Tiện 8",
		"dur": "30:24",
		"url": ["23-Pham-Phuong-Tien-8"]
	  },
	  {
		"stt": 24,
		"tit": "Phẩm Phương Tiện 9",
		"dur": "20:20",
		"url": ["24-Pham-Phuong-Tien-9"]
	  },
	  {
		"stt": 25,
		"tit": "Phẩm Phương Tiện 10",
		"dur": "36:37",
		"url": ["25-Pham-Phuong-Tien-10"]
	  },
	  {
		"stt": 26,
		"tit": "Phẩm Thí Dụ 1",
		"dur": "38:39",
		"url": ["26-Pham-Thi-Du-1"]
	  },
	  {
		"stt": 27,
		"tit": "Phẩm Thí Dụ 2",
		"dur": "25:29",
		"url": ["27-Pham-Thi-Du-2"]
	  },
	  {
		"stt": 28,
		"tit": "Phẩm Thí Dụ 3",
		"dur": "18:40",
		"url": ["28-Pham-Thi-Du-3"]
	  },
	  {
		"stt": 29,
		"tit": "Phẩm Thí Dụ 4",
		"dur": "33:14",
		"url": ["29-Pham-Thi-Du-4"]
	  },
	  {
		"stt": 30,
		"tit": "Phẩm Thí Dụ 5",
		"dur": "22:32",
		"url": ["30-Pham-Thi-Du-5"]
	  },
	  {
		"stt": 31,
		"tit": "Phẩm Thí Dụ 6",
		"dur": "20:34",
		"url": ["31-Pham-Thi-Du-6"]
	  },
	  {
		"stt": 32,
		"tit": "Phẩm Thí Dụ 7",
		"dur": "26:02",
		"url": ["32-Pham-Thi-Du-7"]
	  },
	  {
		"stt": 33,
		"tit": "Phẩm Thí Dụ 8",
		"dur": "34:49",
		"url": ["33-Pham-Thi-Du-8"]
	  },
	  {
		"stt": 34,
		"tit": "Phẩm Thí Dụ 9",
		"dur": "22:04",
		"url": ["34-Pham-Thi-Du-9"]
	  },
	  {
		"stt": 35,
		"tit": "Phẩm Thí Dụ 10",
		"dur": "38:48",
		"url": ["35-Pham-Thi-Du-10"]
	  },
	  {
		"stt": 36,
		"tit": "Phẩm Thí Dụ 11",
		"dur": "33:10",
		"url": ["36-Pham-Thi-Du-11"]
	  },
	  {
		"stt": 37,
		"tit": "Phẩm Thí Dụ 12",
		"dur": "33:06",
		"url": ["37-Pham-Thi-Du-12"]
	  },
	  {
		"stt": 38,
		"tit": "Phẩm Tin Hiểu 1",
		"dur": "22:59",
		"url": ["38-Pham-Tin-Hieu-1"]
	  },
	  {
		"stt": 39,
		"tit": "Phẩm Tin Hiểu 2",
		"dur": "22:18",
		"url": ["39-Pham-Tin-Hieu-2"]
	  },
	  {
		"stt": 40,
		"tit": "Phẩm Tin Hiểu 3",
		"dur": "28:15",
		"url": ["40-Pham-Tin-Hieu-3"]
	  },
	  {
		"stt": 41,
		"tit": "Phẩm Tin Hiểu 4",
		"dur": "29:33",
		"url": ["41-Pham-Tin-Hieu-4"]
	  },
	  {
		"stt": 42,
		"tit": "Phẩm Tin Hiểu 5",
		"dur": "25:30",
		"url": ["42-Pham-Tin-Hieu-5"]
	  },
	  {
		"stt": 43,
		"tit": "Phẩm Tin Hiểu 6",
		"dur": "22:24",
		"url": ["43-Pham-Tin-Hieu-6"]
	  },
	  {
		"stt": 44,
		"tit": "Phẩm Dược Thảo Dụ 1",
		"dur": "35:57",
		"url": ["44-Pham-Duoc-Thao-Du-1"]
	  },
	  {
		"stt": 45,
		"tit": "Phẩm Dược Thảo Dụ 2",
		"dur": "27:44",
		"url": ["45-Pham-Duoc-Thao-Du-2"]
	  },
	  {
		"stt": 46,
		"tit": "Phẩm Thọ Ký 1",
		"dur": "21:01",
		"url": ["46-Pham-Tho-Ky-1"]
	  },
	  {
		"stt": 47,
		"tit": "Phẩm Thọ Ký 2",
		"dur": "22:29",
		"url": ["47-Pham-Tho-Ky-2"]
	  },
	  {
		"stt": 48,
		"tit": "Phẩm Hóa Thành Dụ 1",
		"dur": "21:49",
		"url": ["48-Pham-Hoa-Thanh-Du-1"]
	  },
	  {
		"stt": 49,
		"tit": "Phẩm Hóa Thành Dụ 2",
		"dur": "23:29",
		"url": ["49-Pham-Hoa-Thanh-Du-2"]
	  },
	  {
		"stt": 50,
		"tit": "Phẩm Hóa Thành Dụ 3",
		"dur": "20:10",
		"url": ["50-Pham-Hoa-Thanh-Du-3"]
	  },
	  {
		"stt": 51,
		"tit": "Phẩm Hóa Thành Dụ 4",
		"dur": "18:10",
		"url": ["51-Pham-Hoa-Thanh-Du-4"]
	  },
	  {
		"stt": 52,
		"tit": "Phẩm Hóa Thành Dụ 5",
		"dur": "21:38",
		"url": ["52-Pham-Hoa-Thanh-Du-5"]
	  },
	  {
		"stt": 53,
		"tit": "Phẩm Hóa Thành Dụ 6",
		"dur": "21:00",
		"url": ["53-Pham-Hoa-Thanh-Du-6"]
	  },
	  {
		"stt": 54,
		"tit": "Phẩm Hóa Thành Dụ 7",
		"dur": "30:34",
		"url": ["54-Pham-Hoa-Thanh-Du-7"]
	  },
	  {
		"stt": 55,
		"tit": "Phẩm Thọ Ký Cho Năm Trăm Vị Đệ Tử 1",
		"dur": "28:50",
		"url": ["55-Pham-Tho-Ky-Cho-Nam-Tram-Vi-De-Tu-1"]
	  },
	  {
		"stt": 56,
		"tit": "Phẩm Thọ Ký Cho Năm Trăm Vị Đệ Tử 2",
		"dur": "30:38",
		"url": ["56-Pham-Tho-Ky-Cho-Nam-Tram-Vi-De-Tu-2"]
	  },
	  {
		"stt": 57,
		"tit": "Phẩm Thọ Ký Cho Năm Trăm Vị Đệ Tử 3",
		"dur": "20:23",
		"url": ["57-Pham-Tho-Ky-Cho-Nam-Tram-Vi-De-Tu-3"]
	  },
	  {
		"stt": 58,
		"tit": "Phẩm Thọ Ký Cho Các Bậc Hữu Học Và Vô Học",
		"dur": "28:07",
		"url": ["58-Pham-Tho-Ky-Cho-Cac-Bac-Huu-Hoc-Va-Vo-Hoc"]
	  },
	  {
		"stt": 59,
		"tit": "Phẩm Pháp Sư 1",
		"dur": "23:48",
		"url": ["59-Pham-Phap-Su-1"]
	  },
	  {
		"stt": 60,
		"tit": "Phẩm Pháp Sư 2",
		"dur": "26:55",
		"url": ["60-Pham-Phap-Su-2"]
	  },
	  {
		"stt": 61,
		"tit": "Phẩm Thấy Bảo Tháp 1",
		"dur": "35:32",
		"url": ["61-Pham-Thay-Bao-Thap-1"]
	  },
	  {
		"stt": 62,
		"tit": "Phẩm Thấy Bảo Tháp 2",
		"dur": "35:27",
		"url": ["62-Pham-Thay-Bao-Thap-2"]
	  },
	  {
		"stt": 63,
		"tit": "Phẩm Thấy Bảo Tháp 3",
		"dur": "32:11",
		"url": ["63-Pham-Thay-Bao-Thap-3"]
	  },
	  {
		"stt": 64,
		"tit": "Phẩm Thấy Bảo Tháp 4",
		"dur": "26:33",
		"url": ["64-Pham-Thay-Bao-Thap-4"]
	  },
	  {
		"stt": 65,
		"tit": "Phẩm Đề Bà Đạt Đa 1",
		"dur": "31:02",
		"url": ["65-Pham-De-Ba-Dat-Da-1"]
	  },
	  {
		"stt": 66,
		"tit": "Phẩm Đề Bà Đạt Đa 2",
		"dur": "25:20",
		"url": ["66-Pham-De-Ba-Dat-Da-2"]
	  },
	  {
		"stt": 67,
		"tit": "Phẩm Đề Bà Đạt Đa 3",
		"dur": "23:43",
		"url": ["67-Pham-De-Ba-Dat-Da-3"]
	  },
	  {
		"stt": 68,
		"tit": "Phẩm Khuyên Trì 1",
		"dur": "22:53",
		"url": ["68-Pham-Khuyen-Tri-1"]
	  },
	  {
		"stt": 69,
		"tit": "Phẩm Khuyên Trì 2",
		"dur": "22:50",
		"url": ["69-Pham-Khuyen-Tri-2"]
	  },
	  {
		"stt": 70,
		"tit": "Phẩm An Lạc Hạnh 1",
		"dur": "26:35",
		"url": ["70-Pham-An-Lac-Hanh-1"]
	  },
	  {
		"stt": 71,
		"tit": "Phẩm An Lạc Hạnh 2",
		"dur": "29:34",
		"url": ["71-Pham-An-Lac-Hanh-2"]
	  },
	  {
		"stt": 72,
		"tit": "Phẩm An Lạc Hạnh 3",
		"dur": "29:50",
		"url": ["72-Pham-An-Lac-Hanh-3"]
	  },
	  {
		"stt": 73,
		"tit": "Phẩm Từ Dưới Đất Vọt Lên 1",
		"dur": "33:08",
		"url": ["73-Pham-Tu-Duoi-Dat-Vot-Len-1"]
	  },
	  {
		"stt": 74,
		"tit": "Phẩm Từ Dưới Đất Vọt Lên 2",
		"dur": "28:18",
		"url": ["74-Pham-Tu-Duoi-Dat-Vot-Len-2"]
	  },
	  {
		"stt": 75,
		"tit": "Phẩm Từ Dưới Đất Vọt Lên 3",
		"dur": "37:06",
		"url": ["75-Pham-Tu-Duoi-Dat-Vot-Len-3"]
	  },
	  {
		"stt": 76,
		"tit": "Phẩm Thọ Lượng Của Như Lai 1",
		"dur": "38:06",
		"url": ["76-Pham-Tho-Luong-Cua-Nhu-Lai-1"]
	  },
	  {
		"stt": 77,
		"tit": "Phẩm Thọ Lượng Của Như Lai 2",
		"dur": "37:51",
		"url": ["77-Pham-Tho-Luong-Cua-Nhu-Lai-2"]
	  },
	  {
		"stt": 78,
		"tit": "Phẩm Phân Biệt Công Đức 1",
		"dur": "26:44",
		"url": ["78-Pham-Phan-Biet-Cong-Duc-1"]
	  },
	  {
		"stt": 79,
		"tit": "Phẩm Phân Biệt Công Đức 2",
		"dur": "26:21",
		"url": ["79-Pham-Phan-Biet-Cong-Duc-2"]
	  },
	  {
		"stt": 80,
		"tit": "Phẩm Phân Biệt Công Đức 3",
		"dur": "28:10",
		"url": ["80-Pham-Phan-Biet-Cong-Duc-3"]
	  },
	  {
		"stt": 81,
		"tit": "Phẩm Tùy Hỷ Công Đức 1",
		"dur": "21:44",
		"url": ["81-Pham-Tuy-Hy-Cong-Duc-1"]
	  },
	  {
		"stt": 82,
		"tit": "Phẩm Tùy Hỷ Công Đức 2",
		"dur": "21:20",
		"url": ["82-Pham-Tuy-Hy-Cong-Duc-2"]
	  },
	  {
		"stt": 83,
		"tit": "Phẩm Công Đức Pháp Sư 1",
		"dur": "32:39",
		"url": ["83-Pham-Cong-Duc-Phap-Su-1"]
	  },
	  {
		"stt": 84,
		"tit": "Phẩm Công Đức Pháp Sư 2",
		"dur": "28:06",
		"url": ["84-Pham-Cong-Duc-Phap-Su-2"]
	  },
	  {
		"stt": 85,
		"tit": "Phẩm Công Đức Pháp Sư 3",
		"dur": "30:05",
		"url": ["85-Pham-Cong-Duc-Phap-Su-3"]
	  },
	  {
		"stt": 86,
		"tit": "Phẩm Công Đức Pháp Sư 4",
		"dur": "29:05",
		"url": ["86-Pham-Cong-Duc-Phap-Su-4"]
	  },
	  {
		"stt": 87,
		"tit": "Phẩm Bồ Tát Thường Bất Khinh",
		"dur": "38:28",
		"url": ["87-Pham-Bo-Tat-Thuong-Bat-Khinh"]
	  },
	  {
		"stt": 88,
		"tit": "Phẩm Thần Lực Của Như Lai",
		"dur": "27:44",
		"url": ["88-Pham-Than-Luc-Cua-Nhu-Lai"]
	  },
	  {
		"stt": 89,
		"tit": "Phẩm Chúc Lụy",
		"dur": "13:03",
		"url": ["89-Pham-Chuc-Luy"]
	  },
	  {
		"stt": 90,
		"tit": "Phẩm Bổn Sự Của Bồ Tát Dược Vương 1",
		"dur": "37:32",
		"url": ["90-Pham-Bon-Su-Cua-Bo-Tat-Duoc-Vuong-1"]
	  },
	  {
		"stt": 91,
		"tit": "Phẩm Bổn Sự Của Bồ Tát Dược Vương 2",
		"dur": "36:50",
		"url": ["91-Pham-Bon-Su-Cua-Bo-Tat-Duoc-Vuong-2"]
	  },
	  {
		"stt": 92,
		"tit": "Phẩm Bồ Tát Diệu Âm 1",
		"dur": "28:02",
		"url": ["92-Pham-Bo-Tat-Dieu-Am-1"]
	  },
	  {
		"stt": 93,
		"tit": "Phẩm Bồ Tát Diệu Âm 2",
		"dur": "28:37",
		"url": ["93-Pham-Bo-Tat-Dieu-Am-2"]
	  },
	  {
		"stt": 94,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 1",
		"dur": "38:31",
		"url": ["94-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-1"]
	  },
	  {
		"stt": 95,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 2",
		"dur": "36:12",
		"url": ["95-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-2"]
	  },
	  {
		"stt": 96,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 3",
		"dur": "23:31",
		"url": ["96-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-3"]
	  },
	  {
		"stt": 97,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 4",
		"dur": "28:29",
		"url": ["97-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-4"]
	  },
	  {
		"stt": 98,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 5",
		"dur": "30:44",
		"url": ["98-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-5"]
	  },
	  {
		"stt": 99,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 6",
		"dur": "29:48",
		"url": ["99-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-6"]
	  },
	  {
		"stt": 100,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 7",
		"dur": "27:40",
		"url": ["100-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-7"]
	  },
	  {
		"stt": 101,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 8",
		"dur": "33:52",
		"url": ["101-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-8"]
	  },
	  {
		"stt": 102,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 9",
		"dur": "42:19",
		"url": ["102-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-9"]
	  },
	  {
		"stt": 103,
		"tit": "Phẩm Phổ Môn Bồ Tát Quán Thế Âm 10",
		"dur": "38:08",
		"url": ["103-Pham-Pho-Mon-Bo-Tat-Quan-The-Am-10"]
	  },
	  {
		"stt": 104,
		"tit": "Phẩm Đà La Ni",
		"dur": "27:42",
		"url": ["104-Pham-Da-La-Ni"]
	  },
	  {
		"stt": 105,
		"tit": "Phẩm Bổn Sự Của Bồ Tát Vua Diệu Trang Nghiêm 1",
		"dur": "23:26",
		"url": ["105-Pham-Bon-Su-Cua-Bo-Tat-Vua-Dieu-Trang-Nghiem-1"]
	  },
	  {
		"stt": 106,
		"tit": "Phẩm Bổn Sự Của Bồ Tát Vua Diệu Trang Nghiêm 2",
		"dur": "25:28",
		"url": ["106-Pham-Bon-Su-Cua-Bo-Tat-Vua-Dieu-Trang-Nghiem-2"]
	  },
	  {
		"stt": 107,
		"tit": "Phẩm Khuyến Phát Của Phổ Hiền Bồ Tát",
		"dur": "42:05",
		"url": ["107-Pham-Khuyen-Phat-Cua-Pho-Hien-Bo-Tat"]
	  }
	]},
	
	{
	  "title": "Tứ Diệu Đế – Đạt Lai Lạt Ma giảng giải",
	  "eTitle": "Tứ Diệu Đế – Đạt Lai Lạt Ma giảng giải",
	  "author": "Đạt Lai Lạt Ma thứ 14 thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Hướng Dương",
	  "cover": "https://chuagiacngo.com/sites/default/files/styles/original_image_style/public/images/suc-manh-ngoi-but-tu-dieu-de.jpg?itok=9l6T5wJB",
	  "ssrc": ["https://phatphapungdung.com/sach-noi/tu-dieu-de-dat-lai-lat-ma-63706.html"
	  ],
	  "grp": ["BUD.KTDDG1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		]
	  },
	  "year": "",
	  "intro": "Cốt lõi của cuốn sách này hình thành từ chủ đề trọng tâm các bài giảng của đức Dalai Lama trong dịp Ngài giảng giải về tư tưởng và thực hành cho Phật tử ở Barbican Center (Luân Đôn), bao gồm giáo lý <b>Tứ Diệu Đế</b>, là nền tảng mọi giáo pháp của đức Phật. Trong các bài giảng, Ngài đã giải thích đầy đủ về chủ đề này, giúp chúng ta có được sự hiểu biết rõ hơn về Tứ Diệu Đế.<br/>Trong Phật giáo, Tứ Diệu Đế (hay Tứ Thánh Đế) là 'những sự thật của bậc thánh', là những sự thật hay những cái có thật cho 'những người xứng đáng về mặt tâm linh'.Các sự thật bao gồm:<br/>- <b>Khổ đế</b> (dukkha sự không thỏa mãn, sự đau đớn) là một tính chất bẩm sinh khi tồn tại trong các cảnh luân hồi;<br/>- <b>Tập đế</b> (samudaya: nguồn gốc, sự sanh khởi hay là 'nguyên nhân'): dukkha khởi cùng với taṇhā (ái).Trong khi taṇhā được dịch một cách truyền thống trong các ngôn ngữ phương tây là 'nguyên nhân' của khổ (dukkha), taṇhā còn có thể được xem là yếu tố buộc chúng ta vào khổ, hoặc là một phản ứng với khổ, cố gắng để thoát khỏi nó;<br/>- <b>Diệt đế</b> (nirodha: sự đoạn diệt, sự chấm dứt, sự giam cầm): khổ có thể được chấm dứt hoặc được ngăn chặn bằng sự từ bỏ hoặc cắt đứt quan hệ với ái (taṇhā);sự từ bỏ ái sẽ giải thoát khỏi sự trói buộc của khổ;<br/>- <b>Đạo đế</b> (magga: Bát chánh đạo) là con đường dẫn đến sự từ bỏ, sự đoạn diệt ái (tanha) và khổ (dukkha).<br/>Việt dịch từ bản Anh ngữ: Võ Quang Nhân",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Lời Giới Thiệu",
		"dur": "24:17",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-01-Loigioithieu-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 2,
		"tit": "Phẩm Mở Đầu",
		"dur": "38:54",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-02-Phanmodau-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 3,
		"tit": "Hỏi Đáp",
		"dur": "21:45",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-03-Hoidap-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 4,
		"tit": "Chương 1: Dẫn Nhập",
		"dur": "12:22",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-04-Chuong-1-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 5,
		"tit": "Chương 2: Khổ Đế",
		"dur": "27:27",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-05-Chuong-2-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 6,
		"tit": "Vô Minh",
		"dur": "24:51",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-06-Vominh-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 7,
		"tit": "Chương 3: Tập Khổ Đế",
		"dur": "41:57",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-07-Chuong-3-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 8,
		"tit": "Chương 4: Diệt Khổ Đế",
		"dur": "40:22",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-08-Chuong-4-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 9,
		"tit": "Chương 5: Đạo Đế",
		"dur": "26:15",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-09-Chuong-5-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 10,
		"tit": "Phụ Lục 1",
		"dur": "34:43",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-10-Phuluc-1-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 11,
		"tit": "Phụ Lục 2",
		"dur": "21:39",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-11-Phuluc-2-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 12,
		"tit": "Sự Thật Về Nguồn Gốc Của Khổ Đau",
		"dur": "30:48",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-12-Suthatvongkhodau-www.phatphapungdung.com.mp3"
		]
	  },
	  {
		"stt": 13,
		"tit": "Sự Thật Về Sự Chấm Dứt Của Khổ Đau",
		"dur": "36:25",
		"url": [
		  "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/TuDieuDe/Sach-Noi-Audio-Book-Tu-Dieu-De-13-Suthatvongkhodau-www.phatphapungdung.com.mp3"
		]
	  }
	]},
	
	{
	  "title": "Kinh đại thừa (bản dài) - Giảng giải",
	  "eTitle": "Kinh đại thừa (bản dài) - Giảng giải",
	  "author": "Hòa thượng Tuyên Hóa, Hòa thượng Thích Trí Tịnh thuyết giảng",
	  "type": "Kinh điển phật giáo",
	  "mc": "Nhiều người đọc",
	  "cover": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh3SHJrQhHx-IMBZBHTXGmIl_XRCq3GbYZZTAsYS_XN9ut9C87YFF5N-lVq4PyGgn60guselhj-ePxCZ2_slHQ8cyDp9rbIikwCZL_aK_hEPzi1LoFi2PD1SQmIjTCBFbOpRIF4-pUS_zU/s640/h2.jpg",
	  "ssrc": ["https://bothiphap.blogspot.com/"
	  ],
	  "grp": ["BUD.KDTLG1$10", "BUD.MMC", "BUD.MMC"],
	  "year": "",
	  "intro": "Kinh điển Phật giáo có số lượng cực kỳ lớn, thậm chí xưa lấy 84000 để ước chừng tượng trưng về số lượng pháp uẩn.Kinh văn Phật giáo truyền miệng hoặc được viết ở trên giấy mực. Phật tử theo các tông phái khác nhau đặt các bộ kinh, luận này ở những vị trí khác nhau. Mỗi tập kinh Phật thuyết ra đều có ý nghĩa giáo huấn tùy với căn cơ của chúng sinh.",
	  "parts": [
		{
			"stt": 1,
			"tit": "Giảng Giải Kinh Phật Thuyết A Di Đà - Hòa Thượng Tuyên Hóa Giảng giải",
			"dur": "6:18:42",
			"url": ["https://dl.dropboxusercontent.com/s/3wrl93an4pgzu8v/Giang-Giai-Kinh-A-Di-Da.mp3",
			"https://www.googleapis.com/drive/v3/files/1i2ARSz8wcVteyMwtG4MpoaUyS___Yyq0?alt=media&key=AIzaSyAvwKl-8enWVuIQiCtbKxkUqPNOOzLfmzY"
			],
			"infor" : "Kinh này là từ kim khẩu của Phật giảng nói lý vi diệu, không cần phải thưa thỉnh. Các kinh điển khác thì phải có người thưa hỏi Phật mới nói ra. Chỉ riêng kinh A Di Ðà này là không có ai thưa hỏi, Phật tự nói ra. Tại sao thế? Vì nghĩa lý kinh này rất huyền diệu, trí huệ của hàng Thanh văn không thể đạt đến được, tất cả hàng Bồ tát cũng không thể hiểu rõ, cho nên không có nhân duyên người thưa hỏi về pháp môn Tịnh độ. Chỉ vì pháp môn này đáng được nói ra, cho nên Ðức Phật xem thấy căn cơ thành thục bèn tự nói kinh này. Kinh này vì thế rất trọng yếu trong Phật giáo.<br/>Tại sao kinh này lại rất trọng yếu? Khi Phật Pháp sắp diệt, diệt trước nhất là Kinh Lăng Nghiêm, vì tất cả Ma vương đều rất sợ chú Lăng Nghiêm. Sau khi Kinh Lăng Nghiêm diệt, các kinh khác lần lượt diệt theo. Lúc bấy giờ dù có giấy đi nữa, nhưng trên giấy không có chữ. Sau cùng chỉ còn Kinh A Di Ðà lưu lại thế gian một trăm năm để hóa độ vô lượng vô biên chúng sanh mà thôi. Nhờ sáu chữ hồng danh Nam Mô A Di Ðà Phật mà rất nhiều người được độ, có đến số vô lượng vô biên. Sau đó trong sáu chữ hồng danh lại mất đi hai chữ 'Nam mô', chỉ còn 'A Di Ðà Phật' lưu lại một trăm năm nữa. Sau đó Phật pháp mới diệt hẳn. Kinh này diệt sau cùng nên là kinh rất trọng yếu trong Phật pháp.<br/>Hán Văn: Dao Tần Tam Tạng Pháp Sư Cưu Ma La Thập.<br/>Giảng giải: Vạn Phật Thánh Thành, Tuyên Hóa Thượng Nhân.<br/>Việt dịch: Hòa thượng Thích Trí Tịnh."
		},
		{
			"stt": 2,
			"tit": "Bát Chánh Đạo - Tứ Diệu Đế (Hòa Thượng Tuyên Hóa Giảng giải)",
			"dur": "8:41:57",
			"url": ["https://archive.org/download/Bat_Chanh_Dao-Tu-Dieu-De/BÁT CHÁNH ĐẠO.mp3"
			],
			"infor" : "Điển cố Phật giáo ghi rằng Phật đến Vườn Nai, giảng Tứ Diệu Đế và Thập Nhị Nhân Duyên cho nhóm ông Kiều Trần Như nghe, những lời Phật giảng trong thời gian nầy được ghi vào kinh A Hàm. Đức Phật giảng “Tứ Diệu Đế” để giải rõ tình trạng đời người và dạy phương pháp thay đổi tình trạng đó. “Tứ” là bốn; “Diệu” là huyền diệu, mầu nhiệm, cao quý; “Đế”, là sự thật, là chân lý. Tứ Diệu Đế là bốn chân lý mầu nhiệm. Đó là: khổ (Khổ Đế); nguồn gốc của khổ (Tập Đế); sự diệt khổ (Diệt Đế) và con đường dẫn đến sự diệt khổ (Đạo Đế).<br/>Khổ phải được thông suốt, hiểu biết. Nguồn gốc của khổ, nguyên nhân gây ra khổ (tức ái dục) phải được tận diệt. Sự diệt khổ (tức Niết Bàn) phải được chứng ngộ. Con đường dẫn đến sự diệt khổ (tức Bát Chánh Đạo) phải được phát triển. Dầu chư Phật có giáng sinh hay không, bốn Chân Lý ấy vẫn có trên thế gian. Chư Phật chỉ khám phá ra và vạch rõ cho nhân loại thấy bốn chân lý mầu nhiệm này mà thôi."
		},
		{
			"stt": 3,
			"tit": "Kinh Đại Thừa Vô Lượng Thọ",
			"dur": "2:32:14",
			"url": ["https://dl.dropboxusercontent.com/s/ayxi7qupx5asr43/phat-thuyet-dai-thua-vo-luong-tho-trang-nghiem-thanh-tinh-binh-dang-giac-kinh-Dien-doc.mp3"
			],
			"infor" : "Quán Vô Lượng Thọ kinh là một trong ba bộ kinh quan trọng nhất của Tịnh độ tông. Kinh miêu tả thế giới phương Tây của Phật A-di-đà và dạy cách hành trì: sống thanh tịnh, giữ giới luật và niệm danh hiệu Phật A-di-đà, hành giả thoát khỏi các nghiệp bất thiện và được tái sinh nơi Tịnh độ của A-di-đà.<br/>Kinh này chỉ rõ quá trình phát sinh giáo pháp của Tịnh độ tông và thật ra đã được đức Phật lịch sử Thích-ca trình bày. Tương truyền rằng, hoàng hậu Vi-đề-hi, mẹ của vua A-xà-thế, bị con mình bắt hạ ngục cùng với chồng là vua Tần-bà-sa-la. Bà nhất tâm cầu nguyện Phật và khi Phật hiện đến, bà xin tái sinh nơi một cõi yên lành hạnh phúc. Phật dùng thần lực cho bà thấy mọi thế giới tịnh độ, cuối cùng bà chọn cõi Cực lạc của A-di-đà. Phật dạy cho bà phép thiền định để được tái sinh nơi cõi đó. Phép thiền định này gồm 16 phép quán tưởng, và tuỳ theo nghiệp lực của chúng sinh, các phép này có thể giúp tái sinh vào một trong chín cấp bậc của Tịnh độ."
		},
		{
			"stt": 4,
			"tit": "Kinh Kim Cang - Hòa Thượng Tuyên Hóa Giảng giải",
			"dur": "4:32:27",
			"url": ["https://www.googleapis.com/drive/v3/files/18n2-dTLy68qBGhz5w1UtRe9qw3y_RGWE?alt=media&key=AIzaSyChQB7GdyJgbttOlRZmfkQakidBvQbNRbU"
			]
		},
		{
			"stt": 5,
			"tit": "Kinh Từ Bi Đạo Tràng Lương Hoàng Sám Pháp",
			"dur": "9:12:00",
			"url": ["https://archive.org/download/kinh-luong-hoang-sam-phap/Kinh-Luong-Hoang-Sam-Phap.mp3",			"https://dl.dropboxusercontent.com/s/8tob7ivxkt5zrlw/Kinh-Luong-Hoang-Sam-Phap.mp3"
			],
			"infor" : "Phàm là người sanh trong cõi Dục này, trừ các bực đã hoàn toàn giác ngộ, thì không một ai tránh khỏi lỗi lầm, bởi ba nghiệp gây nên. Các tội lỗi dã từ ba nghiệp phát sanh, nên người muốn dứt trừ hết tội lỗi, tất nhiên phải đem ba nghiệp ấy để sám hối, thì tội lỗi mới được thanh tịnh.<br/>Toàn bộ kinh này là những lời sám nguyện giải trừ mọi điều tội lỗi. Còn gọi là kinh Ðại Sám. Nội dung kinh này khá dài, nguyên nhân trước thuật kinh này là vì vua Lương Vũ Ðế xưa không tin Phật pháp, chỉ tin ngoại đạo. Thuở còn hàn vi, có vợ là Hy-thị, nhân sự ghen tuông mà tự trầm mình dưới giếng. Ðến khi Lương Vũ Ðế lên ngôi vua thì Hy-thị hóa làm con rắng mãng xà quấy rối cung vi.<br/>Hiệu Chính: Hòa thượng Thích Trí Tịnh. Dịch Giả: Hòa thượng Thích Viên Giác"
		},
		{
			"stt": 6,
			"tit": "Thần Chú Đại Bi - Ðại Bi Tâm Ðà Ra Ni (Hòa Thượng Tuyên Hóa Giảng giải)",
			"dur": "2:58:32",
			"url": ["https://www.googleapis.com/drive/v3/files/1PKml_HWXXcSyEGO80DKcDKbODa56sCoV?alt=media&key=AIzaSyAvwKl-8enWVuIQiCtbKxkUqPNOOzLfmzY"
			],
			"infor" : "Hòa Thượng Tuyên Hóa giảng vào năm 1969 tại Phật Giáo Giảng Ðường tại Tam Phan Thị (San Francisco) Chú Ðại Bi, vốn chẳng có cách gì giảng được, vì Chú là mật ngữ bí mật. Bài kệ của Hòa Thượng Tuyên Hóa nói về Chú Ðại Bi như sau:<br/>Ðại bi đại Chú thông thiên địa.<br/>Nhất bách nhất thiên thập vương hoan.<br/>Ðại bi đại từ năng khử bệnh.<br/>Nghiệt kính nhất chiếu biển cao huyền <br/>Giảng giải: Hòa Thượng Tuyên Hóa.<br/>Việt dịch: Tỳ Kheo Thích Minh Ðịnh."
		}
	]},
	
	{
	  "title": "Thập Đại Đệ Tử Phật",
	  "eTitle": "Thập Đại Đệ Tử Phật",
	  "author": "Hòa thượng Tinh Vân",
	  "type": "Truyện phật giáo",
	  "mc": "Nhiều người đọc",
	  "cover": "https://newshop.vn/public/uploads/products/46298/sach-10-dai-de-tu-phat.jpg",
	  "ssrc": ["https://ph.tinhtong.vn/Home/MP3?p=MP3*Thập+Đại+Đệ+Tử+Truyện",
	  "https://chuagiacngo.com/sach-noi/thap-dai-de-tu-truyen",
	  "https://phatphapungdung.com/sach-noi/thap-dai-de-tu-phat-61485.html",
	  "https://www.youtube.com/playlist?list=PLeR5jJdxFiRjVFcH9m0mSYizKJs3bmUl8"
	  ],
	  "grp": ["BUD.TDDTP1$10", "BUD.MMC", "BUD.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": -1,
			"wcSrc": "https://ph.tinhtong.vn/ftp/MP3/Thập Đại Đệ Tử Truyện/Thập Đại Đệ Tử Truyện <*~~*>.mp3"
		  },
		  {
			"urlLine": 1,
			"nd": -1,
			"wcSrc": "http://chuagiacngo.com/sach/thapdaidetutruyen/tddtt_<*~~*>.mp3"
		  },
		  {
			"urlLine": 2,
			"nd": -1,
			"wcSrc": "https://s1.phatphapungdung.com/media/bookspeak/TongHopPhatPhap/ThapDaiDeTu/Sach-Noi-Audio-Book-Thap-Dai-De-Tu-<*~~*>-www.phatphapungdung.com.mp3"
		  }
		],
		"img": "https://i.ytimg.com/vi/<*~~*>/hqdefault.jpg",
		"oUrl": "https://www.youtube.com/watch?v=<*~~*>&list=PLeR5jJdxFiRjVFcH9m0mSYizKJs3bmUl8"
	  },
	  "tap": [
		{"label": "MC: Thiện Quang, Nguyên Châu, Thanh Thuyết, Thiện Nhân", "f": 1, "t": 10},
		{"label": "MC: Hướng Dương", "f": 11, "t": 30},
	  ],
	  "year": "",
	  "intro": "Ngày xưa thuở Phật còn tại thế, đa phần các đệ tử xuất gia của Ngài đều chứng A La Hán, như 1.250 vị tỳ kheo mà kinh thường nhắc đến. Trong số đó bậc ưu tú về mặt đạo hạnh, sở trường và sở chứng, có mười vị được gọi là mười đại đệ tử, gọi chung là Thánh Chúng. Lịch sử Phật giáo liệt kê như sau:<br/>1. Tôn giả Xá Lợi Phất, Trí tuệ đệ nhất.<br/>2. Tôn giả Mục Kiền Liên, Thần thông đệ nhất.<br/>3. Tôn giả Đại Ca Diếp, Đầu đà đệ nhất.<br/>4. Tôn giả A Na Luật, Thiên nhãn đệ nhất.<br/>5. Tôn giả Tu Bồ Đề, Giải không đệ nhất.<br/>6. Tôn giả Phú Lâu Na, Thuyết pháp đệ nhất.<br/>7. Tôn giả Ca Chiên Diên, Luận nghị đệ nhất.<br/>8. Tôn giả Ưu Ba Ly , Trì giới đệ nhất.<br/>9. Tôn giả La Hầu La, Mật hạnh đệ nhất.<br/>10. Tôn giả A Nan Đà, Đa văn đệ nhất.<br/>Tác giả: Đại lão Hòa thượng Tinh Vân<br/>Việt dịch: Như Đức",
	  "parts": [
		{
			"stt": 1,
			"tit": "Tôn Giả Xá Lợi Phất: Trí Tuệ Đệ Nhất",
			"url": [
				"01 - Tôn Giả Xá Lợi Phất, Trí Tuệ Đệ Nhất"
			],
			"dur": "1:14:15",
			"img": "WYMmy-wal4A",
			"infor": "<img style='clip-path: inset(30px 0px 17px 0px);margin: -30px 6px -20px 0px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-1-1442.jpg'>Ngài được xem là trưởng tử của đức Phật, là chấp pháp tướng quân, thường giảng dạy đồ chúng thay cho đức Phật và hướng dẫn cho nhiều vị đắc quả A La Hán. Ngài luôn luôn tỏ ra khiêm tốn, tận tụy, nhiệt tình, được chư Tăng thán phục và được Đức Phật khen là Trí tuệ bậc nhất. Ngài đắc quả A La Hán 4 tuần sau khi xin gia nhập giáo đoàn. Xá Lợi Phất là con trong một gia đình danh giá Bà La Môn ở vùng Ubatissa. Từ nhỏ rất thông tuệ, học giỏi, được mọi người trọng vọng. Ngài có người bạn thân là Mục Kiền Liên. Cả hai Ngài là môn đệ xuất sắc của một vị thầy nổi tiếng, đã đạt được những thành quả tột đỉnh của môn phái ấy nhưng chưa vừa ý nên khi gặp đệ tử Phật (Ngài Assaji : A Tháp Bà Trì) liền nhận ra chánh pháp và quy y Phật.",
			"eTit": "Sariputra – Sariputa (Tôn giả Xá Lợi Phất)"
		},
		{
			"stt": 2,
			"tit": "Tôn Giả Mục Kiền Liên: Thần Thông Đệ Nhất",
			"url": [
				"02 - Tôn Giả Mục Kiền Liên, Thần Thông Đệ Nhất"
			],
			"dur": "52:53",
			"img": "Jk-xJOfAmos",
			"infor": "<img style='width:80px' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-2-1443.jpg'>Ngài là con một gia đình Bà La Môn đanh tiếng. Ngài theo Tôn giả Xá Lợi Phất quy y Phật và sau 7 ngày đắc quả A La Hán, dưới sự hướng dẫn trực tiếp của Đức Phật trong Định, khi Ngài đang sống độc cư trong rừng. Ngài được Đức Phật khen và đại chúng công nhận là Thần thông bậc nhất. Ngài đã nhiều lần thi triển thần thông như phương tiện để giáo hóa cứu độ mọi người. Ngài cùng với Xá Lợi Phất điều hành và hướng dẫn Tăng chúng, cũng như độ cho nhiều người chứng đắc Thánh quả. về sau, Ngài bị phái Ni Kiền Tử hảm hại bằng cách lăn đá làm Ngài bị tử thương. Đức Phật xác nhận Ngài Mục Kiền Liên đã nhập Niết Bàn ngay tại chỗ thọ nạn, nơi Ngài bỏ thân tứ đại.",
			"eTit": "Maudgalyayana – Moggallana (Tôn giả Mục Kiền Liên)"
		},
		{
			"stt": 3,
			"tit": "Tôn Giả Ma Ha (Đại) Ca Diếp: Đầu Đà Đệ Nhất",
			"url": [
				"06 - Tôn Giả Đại Ca Diếp, Đầu Đà Đệ Nhất"
			],
			"dur": "1:00:24",
			"img": "yyS2ADMMn4Y",
			"infor": "<img style='width:65px' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-3-1443.jpg'>Ngài được Đức Thế Tôn nhiếp hóa trước hai tôn giả Xá Lợi Phất và Mục Kiền Liên, được Thế Tôn cho là Đầu Đà đệ nhất. Sinh hoạt theo hạnh đầu đà là một lối sinh hoạt cực kỳ đơn giản nhằm mục đích tịnh hoá tâm hồn, rất thích hợp với những ai thích tu phạm hạnh như Ngài Ca Diếp. Sau khi xuất gia tu hạnh Đầu Đà trong 8 ngày liền, Ngài đắc quả A La Hán. Ngài tinh thông con đường thiền định, nêu gương sáng cho chúng Tăng về các hạnh : “Ít muốn, biết đủ, tinh tân, viễn ly”. Ngài thường độc cư trong rừng dù tuổi đã cao.",
			"eTit": "Mahakasyapa-Mahakassapa (Tôn Giả Ma Ha Ca Diếp)"
		},
		{
			"stt": 4,
			"tit": "Tôn Giả A Na Luật: Thiên Nhãn Đệ Nhất",
			"url": [
				"07 - Tôn Giả A Na Luật, Thiên Nhãn Đệ Nhất"
			],
			"dur": "51:13",
			"img": "YrzIYzYdnyE",
			"infor": "<img class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-4-1443.jpg'>Trong tăng chúng Ngài nổi tiếng là bậc tu hành rất thanh tịnh, không bao giờ bị nữ sắc cám dỗ, vì vậy được mọi người kính ngưỡng. Duy có một tật nhỏ là tật ưa ngủ gục mỗi khi ngồi nghe Phật thuyết pháp, từng bị Phật quở trách đôi ba phen. Từ đó Ngài lập hạnh “không ngủ” từ đầu hôm đến suốt sáng, từ tản sáng đến chiều đêm, Ngài ngồi mở to đôi mắt nhìn vào khoảng không, không chớp mắt, cho đến một hôm thì hai mắt xưng vù rồi bị mù loà. Chính đức Phật cầm tay chỉ dạy giúp Ngài may áo và dạy phương pháp tu định để khiến mắt sáng ra, Ngài thực hành một cách triệt để nên được sáng mắt trở lại và chứng được Thiên nhãn thông, bất quản xa gần, bất luận trong ngoài, mắt Ngài đều thấy suốt. Phật dùng chánh pháp phương tiện dạy cho Ngài thể nhập tánh thây viên dung, không lệ thuộc vào nhãn căn. Ngài chứng đắc pháp này và thấy ba cõi như một quả Amla được cầm trên tay, được Phật ấn chứng là Thiên nhãn đệ nhất.",
			"eTit": "Aniruddha – Anurauddha (Tôn giả A Nâu Đà La)"
		},
		{
			"stt": 5,
			"tit": "Tôn Giả Tu Bồ Đề: Giải Không Đệ Nhất",
			"url": [
				"04 - Tôn Giả Tu Bồ Đề, Giải Không Đệ Nhất"
			],
			"dur": "55:24",
			"img": "N9HDJ17HOew",
			"infor": "<img style='clip-path: inset(30px 0px 28px 0px);margin: -31px 6px -31px 0px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-5-1447.jpg'>Theo truyền thuyết của kinh sách Đại thừa, lúc Ngài mới sanh, trong gia đình Ngài toàn hiện ra những triệu chứng “không”. Các đồ vật trong nhà, từ kho lẫm, lu vãi... mọi vật biến đâu mất cả, chỉ thuần tịnh một mùi hương chiên đàn và hào quang sáng soi chấn động cả ba cõi, không thấy đâu là tường vách giới hạn. Hỏi về ý nghĩa điềm lạ này thì được thầy tướng bảo rằng đó là điều cực lành. Rồi nhân vì điềm “không” ấy, nên cha mẹ Ngài mới đặt tên cho Ngài là Tu Bồ Đề, nghĩa là Không Sanh. Lại cũng có nghĩa là Thiện Cát (tốt lành) hay Thiện Hiện (hiện điềm tốt).",
			"eTit": "Subhuti (Tôn giả Tu Bồ Đề)"
		},
		{
			"stt": 6,
			"tit": "Tôn Giả Phú Lâu Na: Thuyết Pháp Đệ Nhất",
			"url": [
				"03 - Tôn Giả Phú Lâu Na, Thuyết Pháp Đệ Nhất"
			],
			"dur": "48:37",
			"img": "2-T3riifRBg",
			"infor": "<img style='width: 83px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-6-1447.jpg'>Tôn giả Phú Lâu Na vốn được gọi là 'Phú-lâu-na Di-đa-la-ni-tử'. Phú Lâu Na chỉ là tiếng gọi tắt. Danh hiệu Ngài dài như thế chính là biểu hiện cho Tôn giả khi thuyết pháp cũng trường mãn vô cùng. Danh xưng của Ngài được dịch sang tiếng Trung Hoa là 'Mãn Từ Tử'. Đức Phật thường ngợi khen biện tài ngôn luận của Tôn giả trước đại chúng: 'Các ông cũng nên xưng tán Phú-lâu-na. Ta thường khen ông ấy là bậc nhất trong hạng người thuyết pháp. Ông ấy thâm nhập biển Phật pháp hay làm lợi ích cho tất cả người đồng tu học đạo'. Trừ đức Phật ra, không ai có thể biện bác ngôn luận với ông.",
			"eTit": "Purna – Punna (Tôn Giả Phú Lâu Na)"
		},
		{
			"stt": 7,
			"tit": "Tôn Giả Ca Chiên Diên: Luận Nghị Đệ Nhất",
			"url": [
				"05 - Tôn Giả Ca Chiên Diên, Luận Nghị Đệ Nhất"
			],
			"dur": "1:03:13",
			"img": "ruiWq6GDWKg",
			"infor": "<img style='width: 72px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-7-1448.jpg'>Thời Phật còn tại thế, trong số 10 đại đệ tử, Ca Chiên Diên (Katyayana) không những chỉ thông hiểu những tư tưởng triết học đương thời, am tường giáo pháp của ức Phật, mà còn có tài luận nghị khiến ai vấn nạn cũng đều thán phục. Phật và Thánh chúng phong tặng cho Ngài là bậc Luận Nghị Ðệ Nhất. Ngài có biệt tài dùng lời nói rất đơn giản khiến những ai vấn nạn Ngài đều phải thần phục. Trong suốt cuộc đời hành hoá, nhờ tài nghị luận xảo diệu, Ngài đã cảm hoá được rất nhiều người, khiến họ tỉnh ngộ trở về với Tam bảo, sống một đời sống thanh thản an vui.",
			"eTit": "Katyayana - Kaccayana, Kaccana (Tôn Giả Ca Chiên Diên)"
		},
		{
			"stt": 8,
			"tit": "Tôn Giả Ưu Ba Ly: Trì Giới Đệ Nhất",
			"url": [
				"08 - Tôn Giả Ưu Ba Ly, Trì Giới Đệ Nhất"
			],
			"dur": "51:53",
			"img": "MN4MtuXdRqs",
			"infor": "<img style='width: 73px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-8-1448.jpg'>Ưu Ba Ly vốn thuộc giai cấp nô lệ Thủ Đà La, xuất thân làm nghề thợ cạo tóc, hầu hạ trong vương cung. Ngày Phật về thăm Ca Tỳ La lần đầu tiên và chấp thuận cho các vương tử xuất gia, Ưu Ba Ly tủi hổ cho phận mình sanh ra trong chốn hạ tiện, ở thế gian làm thân nô lệ đã đành, muốn lìa thế gian đi tu cũng không được phép. Ngài là người nô lệ đầu tiên được Phật cho xuất gia, thu nhận vào tăng đoàn. Xuất gia tu thiền sau một thời gian ngắn Ngài chứng quả A La Hán. Ngài được Đức Phật cho là đệ nhất Trì giới và được giao việc xử lý và tuyên luật.",
			"eTit": "Upali (Tôn Giả Ưu Ba Ly)"
		},
		{
			"stt": 9,
			"tit": "Tôn Giả La Hầu La: Mật Hạnh Đệ Nhất",
			"url": [
				"10 - Tôn Giả La Hầu La, Mật Hạnh Đệ Nhất"
			],
			"dur": "45:37",
			"img": "pUdvcmhHZV8",
			"infor": "<img class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-10-1449.jpg'>Ngài là con của Thái tử Tất Đạt Đa và công chúa Da Du Đà La. Khi về thăm quê lần đầu tiên, Phật phương tiện tìm cách đưa La Hầu La đi xuất gia và giao cho Xá Lợi Phất dạy bảo. Được Phật và Xá Lợi Phất từ mẫn giáo hoá, tập khí cương cường của giồng máu vương giả trong người La Hầu La mỗi ngày mỗi lạt phai và tánh tình lần lần trở nên ôn hoà nhu thuận. Ngài nghiêm trì giới luật, tinh tấn đạo tâm, quyết luyện mật hạnh. Sau một thời gian chăm chú luyện mật hạnh và từ câu nói đơn giản của Phật “Hãy nhìn vào vạn tượng sum la kia, rồi nhìn lui vào tâm niệm và thân thể của mình, để xem có gì đứng yên một chỗ không? Vô thường! Vô thường tất cả! Nên biết như thế và đừng để cho tâm chấp trước dính mắc vào đâu cả”. Chiêm nghiệm lời Phật dạy, Ngài đã chứng được tận cùng của Mật hạnh và được Phật khen là Mật hạnh đệ nhất.",
			"eTit": "Rahula (Tôn Giả La Hầu La)"
		},
		{
			"stt": 10,
			"tit": "Tôn Giả A Nan Đà: Đa Văn Đệ Nhất",
			"url": [
				"09 - Tôn Giả A Nan Đà, Đa Văn Đệ Nhất"
			],
			"dur": "1:12:12",
			"img": "SKcr6xNDHos",
			"infor": "<img style='width: 85px;' class='bookChapIntroImg' src='https://i.ex-cdn.com/phatgiao.org.vn/files/content/2019/03/18/10-vi-dai-de-tu-cua-duc-phat-9-1448.jpg'>Ngài là em họ Đức Phật, xuất gia khi Phật về thăm hoàng cung, Ngài là vị tỳ kheo đệ nhất về 5 phương diện : Đa văn, cảnh giác, sức khỏe đi bộ, lòng kiên trì và hầu hạ chu đáo. Được thánh chúng đề nghị làm thị giả Đức Phật khi Đức Phật được 56 tuổi. A Nan hoan hỷ chấp thuận với điều kiện: Thế Tôn từ chối 4 việc và chấp thuận 4 việc: Từ chối: không cho tôn giả y, đồ ăn, phòng ở riêng và mời ăn. Chấp thuận: Thế Tôn cho phép nếu Tôn giả đươc thí chủ mời đi thọ trai, nếu có người từ xa đến xin ý kiến, Thế Tôn cho phép khi A Nan giới thiệu. Thế Tôn cho A Nan yết kiến khi Ngài gặp điều khó xử. Thế Tôn giảng lại những giáo lý cho Ngài, trong những lúc A Nan vắng mặt.",
			"eTit": "Ananda (Tôn Giả A Nan Đà)"
		},
		{
			"stt": 11,
			"tit": "Tôn Giả Xá Lợi Phất: Trí Tuệ Đệ Nhất",
			"dur": "38:23",
			"url": [
				null,
				"01__xa_loi_phat_1",
				"01-Xaloiphat-1"
			],
			"img": "WYMmy-wal4A",
			"eTit": "Sariputra – Sariputa (Tôn giả Xá Lợi Phất)"
		},
		{
			"stt": 12,
			"tit": "Tôn Giả Xá Lợi Phất: Trí Tuệ Đệ Nhất (Phần 2)",
			"dur": "36:18",
			"url": [
				null,
				"02__xa_loi_phat_2",
				"02-Xaloiphat-2"
			],
			"img": "WYMmy-wal4A",
			"eTit": "Sariputra – Sariputa (Tôn giả Xá Lợi Phất)"
		},
		{
			"stt": 13,
			"tit": "Tôn Giả Mục Kiền Liên: Thần Thông Đệ Nhất",
			"dur": "30:58",
			"url": [
				null,
				"03_muc_kien_lien_1",
				"03-Muckienlien-1"
			],
			"img": "Jk-xJOfAmos",
			"eTit": "Maudgalyayana – Moggallana (Tôn giả Mục Kiền Liên)"
		},
		{
			"stt": 14,
			"tit": "Tôn Giả Mục Kiền Liên: Thần Thông Đệ Nhất (Phần 2)",
			"dur": "27:37",
			"url": [
				null,
				"04_muc_kien_lien_2",
				"04-Muckienlien-2"
			],
			"img": "Jk-xJOfAmos",
			"eTit": "Maudgalyayana – Moggallana (Tôn giả Mục Kiền Liên)"
		},
		{
			"stt": 15,
			"tit": "Tôn Giả Ma Ha (Đại) Ca Diếp: Đầu Đà Đệ Nhất",
			"dur": "33:20",
			"url": [
				null,
				"11_dai_ca_diep_1",
				"11-Daicadiep-1"
			],
			"img": "yyS2ADMMn4Y",
			"eTit": "Mahakasyapa-Mahakassapa (Tôn Giả Ma Ha Ca Diếp)"
		},
		{
			"stt": 16,
			"tit": "Tôn Giả Ma Ha (Đại) Ca Diếp: Đầu Đà Đệ Nhất (Phần 2)",
			"dur": "33:47",
			"url": [
				null,
				"12_dai_ca_diep_2",
				"12-Daicadiep-2"
			],
			"img": "yyS2ADMMn4Y",
			"eTit": "Mahakasyapa-Mahakassapa (Tôn Giả Ma Ha Ca Diếp)"
		},
		{
			"stt": 17,
			"tit": "Tôn Giả A Na Luật: Thiên Nhãn Đệ Nhất",
			"dur": "26:47",
			"url": [
				null,
				"13_a_na_luat_1",
				"13-Analuat-1"
			],
			"img": "YrzIYzYdnyE",
			"eTit": "Aniruddha – Anurauddha (Tôn giả A Nâu Đà La)"
		},
		{
			"stt": 18,
			"tit": "Tôn Giả A Na Luật: Thiên Nhãn Đệ Nhất (Phần 2)",
			"dur": "28:32",
			"url": [
				null,
				"14_a_na_luat_2",
				"14-Analuat-2"
			],
			"img": "YrzIYzYdnyE",
			"eTit": "Aniruddha – Anurauddha (Tôn giả A Nâu Đà La)"
		},
		{
			"stt": 19,
			"tit": "Tôn Giả Tu Bồ Đề: Giải Không Đệ Nhất",
			"dur": "29:34",
			"url": [
				null,
				"07_tu_bo_de_1"
			],
			"img": "N9HDJ17HOew",
			"eTit": "Subhuti (Tôn giả Tu Bồ Đề)"
		},
		{
			"stt": 20,
			"tit": "Tôn Giả Tu Bồ Đề: Giải Không Đệ Nhất",
			"dur": "33:12",
			"url": [
				null,
				"08_tu_bo_de_2"
			],
			"img": "N9HDJ17HOew",
			"eTit": "Subhuti (Tôn giả Tu Bồ Đề)"
		},
		{
			"stt": 21,
			"tit": "Tôn Giả Phú Lâu Na: Thuyết Pháp Đệ Nhất",
			"dur": "28:49",
			"url": [
				null,
				"05_phu_lau_na_1",
				"05-Phulauna-1"
			],
			"img": "2-T3riifRBg",
			"eTit": "Purna – Punna (Tôn Giả Phú Lâu Na)"
		},
		{
			"stt": 22,
			"tit": "Tôn Giả Phú Lâu Na: Thuyết Pháp Đệ Nhất (Phần 2)",
			"dur": "23:09",
			"url": [
				null,
				"06_phu_lau_na_2",
				"06-Phulauna-2"
			],
			"img": "2-T3riifRBg",
			"eTit": "Purna – Punna (Tôn Giả Phú Lâu Na)"
		},
		{
			"stt": 23,
			"tit": "Tôn Giả Ca Chiên Diên: Luận Nghị Đệ Nhất",
			"dur": "27:04",
			"url": [
				null,
				"09_ca_chien_dien_1",
				"09-Cachiendien-1"
			],
			"img": "ruiWq6GDWKg",
			"eTit": "Katyayana - Kaccayana, Kaccana (Tôn Giả Ca Chiên Diên)"
		},
		{
			"stt": 24,
			"tit": "Tôn Giả Ca Chiên Diên: Luận Nghị Đệ Nhất (Phần 2)",
			"dur": "31:09",
			"url": [
				null,
				"10_ca_chien_dien_2",
				"10-Cachiendien-2"
			],
			"img": "ruiWq6GDWKg",
			"eTit": "Katyayana - Kaccayana, Kaccana (Tôn Giả Ca Chiên Diên)"
		},
		{
			"stt": 25,
			"tit": "Tôn Giả Ưu Ba Ly: Giới Luật Đệ Nhất",
			"dur": "32:32",
			"url": [
				null,
				"15_uu_ba_ly_1",
				"15-Uubaly-1"
			],
			"img": "MN4MtuXdRqs",
			"eTit": "Upali (Tôn Giả Ưu Ba Ly)"
		},
		{
			"stt": 26,
			"tit": "Tôn Giả Ưu Ba Ly: Giới Luật Đệ Nhất (Phần 2)",
			"dur": "25:49",
			"url": [
				null,
				"16_uu_ba_ly_2",
				"16-Uubaly-2"
			],
			"img": "MN4MtuXdRqs",
			"eTit": "Upali (Tôn Giả Ưu Ba Ly)"
		},
		{
			"stt": 27,
			"tit": "Tôn Giả La Hầu La: Mật Hạnh Đệ Nhất",
			"dur": "25:45",
			"url": [
				null,
				"19_la_hau_la_1",
				"19-Lahaula-1"
			],
			"img": "pUdvcmhHZV8",
			"eTit": "Rahula (Tôn Giả La Hầu La)"
		},
		{
			"stt": 28,
			"tit": "Tôn Giả La Hầu La: Mật Hạnh Đệ Nhất (Phần 2)",
			"dur": "27:22",
			"url": [
				null,
				"20_la_hau_la_2",
				"20-Lahaula-2"
			],
			"img": "pUdvcmhHZV8",
			"eTit": "Rahula (Tôn Giả La Hầu La)"
		},
		{
			"stt": 29,
			"tit": "Tôn Giả A Nan Đà: Đa Văn Đệ Nhất",
			"dur": "39:56",
			"url": [
				null,
				"17_a_nan_da_1",
				"17-Ananda-1"
			],
			"img": "SKcr6xNDHos",
			"eTit": "Ananda (Tôn Giả A Nan Đà)"
		},
		{
			"stt": 30,
			"tit": "Tôn Giả A Nan Đà: Đa Văn Đệ Nhất (Phần 2)",
			"dur": "42:09",
			"url": [
				null,
				"18_a_nan_da_2",
				"18-Ananda-2"
			],
			"img": "SKcr6xNDHos",
			"eTit": "Ananda (Tôn Giả A Nan Đà)"
		}
	]}

]};

const danbrwnData = {
"meta" : {
	"name" : "Dan Brown",
	"eName" : "Dan Brown",
	"bookGrp" : [
		[ {"label": "Dan Brown - Robert Langdon" , "gId": "$11"}, 
		  {"label": "Dan Brown - Tiểu thuyết lẻ" , "gId": "$12"} ],
		[ {"label": "Dan Brown - Robert Langdon" , "gId": "DBR.RLD"}, 
		  {"label": "Dan Brown - Tiểu thuyết lẻ" , "gId": "DBR.TTK"}],
		[ {"label": "Dan Brown", "gId": "DBR.MMC"} ]
	]
},
"books": [
	{
	  "title": "Mật mã Davinci",
	  "eTitle": "The Da Vinci code",
	  "author": "Dan Brown",
	  "type": "Phiêu lưu",
	  "mc": "Lưu Hà (Thế Vinh)",
	  "cover": "https://upload.wikimedia.org/wikipedia/vi/8/84/M%E1%BA%ADt_m%C3%A3_davinci.jpg",
	  "ssrc": [
		"https://www.lachoncoc.com/2014/12/blog-post.html",
		"https://archive.org/details/TruyenAudioMatMaDaVinci-Truyenaudio.net/"
	  ],
	  "grp": ["DBR.TAP1$11", "DBR.RLD", "DBR.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/TruyenAudioMatMaDaVinci-Truyenaudio.net/MatMaDaVinci-p<*~~*>truyenaudio.net.mp3"
		  }
		]
	  },
	  "year": 2003,
	  "intro": "Mật mã Da Vinci (tiếng Anh: The Da Vinci Code) là một tiểu thuyết của nhà văn người Mỹ Dan Brown được xuất bản năm 2003 bởi nhà xuất bản Doubleday Fiction. Đây là một trong số các quyển sách bán chạy nhất thế giới với trên 40 triệu quyển được bán ra (tính đến tháng 3 năm 2006), và đã được dịch ra 44 ngôn ngữ.<br/>Tổng hợp các thể loại hư cấu trinh thám, giật gân và âm mưu, quyển sách là một trong bốn tiểu thuyết liên quan tới nhân vật Robert Langdon, cùng với Thiên thần và Ác quỷ (Angels and Demons), Biểu tượng thất truyền (The Lost Symbol, trước đây được biết đến với tên The Solomon Key) và Hỏa ngục (Inferno).<br/>Cốt truyện của tiểu thuyết kể về âm mưu của Giáo hội Công giáo nhằm che dấu sự thật về Chúa Giê-su. Truyện ám chỉ rằng Tòa thánh Vatican biết rõ âm mưu này từ hai ngàn năm qua, nhưng vẫn giấu kín để giữ vững quyền lực của mình.<br/>Sau khi vừa xuất bản, cuốn tiểu thuyết đã khơi dậy mạnh mẽ sự tò mò khắp thế giới đi tìm hiểu sự thật về Sự tích Chén Thánh, và vai trò của Mary Magdalene trong lịch sử Giáo hội Công giáo.<br/>Mật mã Da Vinci nhận được nhiều phê bình sâu sắc. Những người ủng hộ cho rằng quyển tiểu thuyết rất sáng tạo, đầy kịch tính và làm cho người xem phải suy nghĩ. Người chỉ trích thì cho rằng quyển sách không chính xác và viết rất kém, những chỉ trích còn lên án các ẩn ý xấu của Dan Brown về Giáo hội Công giáo.<br/>Truyện bắt đầu bằng những nỗ lực của giáo sư môn 'Biểu tượng Tôn giáo' (Religious Symbology) Robert Langdon tại Đại học Harvard cùng Sophie Neuveu - cháu gái của Jacques Saunière nhằm làm sáng tỏ cái chết bí mật của người quản lý nổi tiếng Jacques Saunière của Bảo tàng Louvre tại Paris. Thi thể của Saunière được tìm thấy sâu trong Bảo tàng Louvre trong tư thế tương tự như bức tranh nổi tiếng Người Vitruvius (Vitruvian Man) của Leonardo Da Vinci, với một thông điệp bí ẩn viết cạnh, và một hình sao năm cánh (ngũ giác) vẽ trên bụng bằng máu. Như tên của tiểu thuyết hàm chỉ, các thông điệp đầy ẩn ý từ các tác phẩm của Leonardo như Mona Lisa và Tiệc Ly (Bữa tối Cuối cùng) (The Last Supper) xuất hiện xuyên suốt tác phẩm dẫn dắt các manh mối làm sáng tỏ vụ án đầy bí mật này.",
	  "parts": [
	  { "stt":  1, "tit": "Phần 1" , "url": [""], "dur": "26:20"   },
	  { "stt":  2, "tit": "Phần 2" , "url": [""], "dur": "23:06"   },
	  { "stt":  3, "tit": "Phần 3" , "url": [""], "dur": "32:25"   },
	  { "stt":  4, "tit": "Phần 4" , "url": [""], "dur": "27:46"   },
	  { "stt":  5, "tit": "Phần 5" , "url": [""], "dur": "26:50"   },
	  { "stt":  6, "tit": "Phần 6" , "url": [""], "dur": "24:50"   },
	  { "stt":  7, "tit": "Phần 7" , "url": [""], "dur": "35:45"   },
	  { "stt":  8, "tit": "Phần 8" , "url": [""], "dur": "39:50"   },
	  { "stt":  9, "tit": "Phần 9" , "url": [""], "dur": "41:06"   },
	  { "stt": 10, "tit": "Phần 10", "url": [""], "dur": "26:00"   },
	  { "stt": 11, "tit": "Phần 11", "url": [""], "dur": "20:25"   },
	  { "stt": 12, "tit": "Phần 12", "url": [""], "dur": "23:26"   },
	  { "stt": 13, "tit": "Phần 13", "url": [""], "dur": "21:53"   },
	  { "stt": 14, "tit": "Phần 14", "url": [""], "dur": "24:44"   },
	  { "stt": 15, "tit": "Phần 15", "url": [""], "dur": "26:37"   },
	  { "stt": 16, "tit": "Phần 16", "url": [""], "dur": "23:21"   },
	  { "stt": 17, "tit": "Phần 17", "url": [""], "dur": "23:52"   },
	  { "stt": 18, "tit": "Phần 18", "url": [""], "dur": "29:17"   },
	  { "stt": 19, "tit": "Phần 19", "url": [""], "dur": "21:58"   },
	  { "stt": 20, "tit": "Phần 20", "url": [""], "dur": "26:57"   },
	  { "stt": 21, "tit": "Phần 21", "url": [""], "dur": "31:38"   },
	  { "stt": 22, "tit": "Phần 22", "url": [""], "dur": "34:03"   },
	  { "stt": 23, "tit": "Phần 23", "url": [""], "dur": "20:43"   },
	  { "stt": 24, "tit": "Phần 24", "url": [""], "dur": "28:31"   },
	  { "stt": 25, "tit": "Phần 25", "url": [""], "dur": "22:19"   },
	  { "stt": 26, "tit": "Phần 26", "url": [""], "dur": "20:28"   },
	  { "stt": 27, "tit": "Phần 27", "url": [""], "dur": "20:12"   },
	  { "stt": 28, "tit": "Phần 28", "url": [""], "dur": "19:47"   },
	  { "stt": 29, "tit": "Phần 29", "url": [""], "dur": "24:41"   },
	  { "stt": 30, "tit": "Phần 30", "url": [""], "dur": "27:49"   },
	  { "stt": 31, "tit": "Phần 31", "url": [""], "dur": "30:11"   },
	  { "stt": 32, "tit": "Phần 32", "url": [""], "dur": "31:15"   },
	  { "stt": 33, "tit": "Phần 33", "url": [""], "dur": "27:55"   },
	  { "stt": 34, "tit": "Phần 34", "url": [""], "dur": "24:00"   },
	  { "stt": 35, "tit": "Phần 35", "url": [""], "dur": "35:04"   },
	  { "stt": 36, "tit": "Phần 36", "url": [""], "dur": "32:26"   },
	  { "stt": 37, "tit": "Phần 37", "url": [""], "dur": "31:30"   },
	  { "stt": 38, "tit": "Phần 38", "url": [""], "dur": "1:00:33" }
	]},
	
	{
	  "title": "Thiên thần và ác quỷ",
	  "eTitle": "Angels and demons",
	  "author": "Dan Brown",
	  "type": "Phiêu lưu",
	  "mc": "Phạm Vân",
	  "cover": "https://upload.wikimedia.org/wikipedia/vi/6/6a/Thien_than_va_ac_quy_vn.jpg",
	  "ssrc": [
		"https://www.lachoncoc.com/2015/02/truyen-audio-vip-thien-than-va-ac-quy.html",
		"https://archive.org/details/thienthanvaacquy15"
	  ],
	  "grp": ["DBR.TAP2$11", "DBR.RLD", "DBR.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/thienthanvaacquy15/thienthanvaacquy<*~~*>.mp3"
		  }
		]
	  },
	  "year": 2000,
	  "intro": "Thiên thần và ác quỷ (tiếng Anh: Angels and Demons) là tiểu thuyết khoa học giả tưởng được xuất bản lần đầu năm 2000 do nhà văn Mỹ Dan Brown, tác giả của Mật mã Da Vinci, Pháo đài số, Điểm dối lừa sáng tác. Câu chuyện xoay quanh nhân vật chính Robert Langdon - nhân vật chính trong các tiểu thuyết của Dan Brown trong đó có Mật mã Da Vinci. Giống như các tác phẩm khác của mình, Dan Brown đã thể hiện trong tiểu thuyết Thiên thần và ác quỷ sự kết hợp giữa truyện trinh thám, các tình huống giải mã bất ngờ và sự lôi cuốn trong vấn đề tôn giáo - đặc biệt là về Công giáo Rôma và Hội kín Illuminati.<br/>Tiểu thuyết giới thiệu nhân vật Robert Langdon, cũng là nhân vật chính trong tiểu thuyết tiếp theo vào năm 2003 - Mật mã Da Vinci. Quyển sách cũng chứa đựng nhiều yếu tố văn học giống như quyển tiếp theo, như là những thông đồng của các cộng đồng bí mật, khung thời gian theo từng ngày, và Giáo hội Công giáo. Những mặt như lịch sử cổ đại, kiến trúc và ký tượng học cũng là chủ đề chính xuyên suốt câu chuyện. Bộ phim cùng tên dựng từ quyển sách đã được khởi chiếu vào ngày 15 tháng 5 năm 2009, sau bộ phim Mật mã Da Vinci đã được chiếu vào năm 2006.",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": [""],
		"dur": "26:20"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": [""],
		"dur": "23:06"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": [""],
		"dur": "32:25"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": [""],
		"dur": "27:46"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": [""],
		"dur": "26:50"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": [""],
		"dur": "24:50"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": [""],
		"dur": "35:45"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": [""],
		"dur": "39:50"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": [""],
		"dur": "41:06"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": [""],
		"dur": "26:00"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": [""],
		"dur": "20:25"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": [""],
		"dur": "23:26"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": [""],
		"dur": "21:53"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": [""],
		"dur": "24:44"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": [""],
		"dur": "26:37"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": [""],
		"dur": "23:21"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": [""],
		"dur": "23:52"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": [""],
		"dur": "29:17"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": [""],
		"dur": "21:58"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": [""],
		"dur": "26:57"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": [""],
		"dur": "31:38"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": [""],
		"dur": "34:03"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": [""],
		"dur": "20:43"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": [""],
		"dur": "28:31"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": [""],
		"dur": "22:19"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": [""],
		"dur": "20:28"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": [""],
		"dur": "20:12"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": [""],
		"dur": "19:47"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": [""],
		"dur": "24:41"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": [""],
		"dur": "27:49"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": [""],
		"dur": "30:11"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": [""],
		"dur": "31:15"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": [""],
		"dur": "27:55"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": [""],
		"dur": "24:00"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": [""],
		"dur": "35:04"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": [""],
		"dur": "32:26"
	  },
	  {
		"stt": 37,
		"tit": "Phần 37",
		"url": [""],
		"dur": "31:30"
	  },
	  {
		"stt": 38,
		"tit": "Phần 38",
		"url": [""],
		"dur": "1:00:33"
	  },
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 01"],
		"dur": "30:57"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 02"],
		"dur": "31:06"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 03"],
		"dur": "24:45"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 04"],
		"dur": "24:39"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 05"],
		"dur": "16:52"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 06"],
		"dur": "19:06"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": ["21kjdfhkjshfkhs/phao dai so 07"],
		"dur": "21:27"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 08"],
		"dur": "18:43"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 09"],
		"dur": "22:07"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 10"],
		"dur": "15:17"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 11"],
		"dur": "19:16"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 12"],
		"dur": "22:59"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 13"],
		"dur": "29:43"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 14"],
		"dur": "18:34"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 15"],
		"dur": "27:43"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": ["21kjdfhkjshfkhs_201503/phao dai so 16"],
		"dur": "20:16"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 17fdhgdgsgd"],
		"dur": "22:14"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 18dfdfhtrbblho"],
		"dur": "21:41"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 19dgarewrtefer"],
		"dur": "20:15"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 20sdghgfgfxbrfrtigb"],
		"dur": "20:04"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 21kjdfhkjshfkhs"],
		"dur": "24:40"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 22fdshjryyryti"],
		"dur": "16:21"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 23regtyytrgdgf"],
		"dur": "28:43"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 24gnZfewhyukjfk"],
		"dur": "20:11"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 25hgerttryifbcfsg"],
		"dur": "32:46"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 26ghgsfwhckyg"],
		"dur": "20:57"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 27qeweutyjvzdg"],
		"dur": "16:58"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 28fsffdsgtyhggfgr"],
		"dur": "17:01"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 29dfdghdgdhrtyeu"],
		"dur": "15:14"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 30ghtytrurefsdghjvxjmy"],
		"dur": "22:22"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": ["31/Phao Dai So 31"],
		"dur": "22:09"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": ["31/Phao Dai So 32"],
		"dur": "20:28"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": ["31/phao dai so 33-chuong 116_2"],
		"dur": "12:33"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": ["31/phao dai so 34 (chuong 123)_2"],
		"dur": "23:44"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": ["31/phao dai so 35 (chuong 127)_2"],
		"dur": "25:55"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": ["31/phao dai so 36(end)_2"],
		"dur": "08:37"
	  },
	  {
		"stt": 37,
		"tit": "Phần 37",
		"url": [null],
		"dur": "00:00"
	  },
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": [""],
		"dur": "23:43"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": [""],
		"dur": "25:23"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": [""],
		"dur": "25:58"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": [""],
		"dur": "17:57"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": [""],
		"dur": "35:56"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": [""],
		"dur": "36:30"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": [""],
		"dur": "35:25"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": [""],
		"dur": "34:27"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": [""],
		"dur": "38:00"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": [""],
		"dur": "45:16"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": [""],
		"dur": "34:24"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": [""],
		"dur": "30:00"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": [""],
		"dur": "29:31"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": [""],
		"dur": "32:53"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": [""],
		"dur": "1:01:36"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": [""],
		"dur": "33:30"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": [""],
		"dur": "33:27"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": [""],
		"dur": "41:13"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": [""],
		"dur": "38:39"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": [""],
		"dur": "31:49"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": [""],
		"dur": "29:46"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": [""],
		"dur": "31:18"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": [""],
		"dur": "32:20"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": [""],
		"dur": "43:06"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": [""],
		"dur": "28:25"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": [""],
		"dur": "32:17"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": [""],
		"dur": "29:55"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": [""],
		"dur": "30:59"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": [""],
		"dur": "32:00"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": [""],
		"dur": "23:38"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": [""],
		"dur": "35:33"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": [""],
		"dur": "32:18"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": [""],
		"dur": "31:02"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": [""],
		"dur": "37:01"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": [""],
		"dur": "24:24"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": [""],
		"dur": "31:17"
	  },
	  {
		"stt": 37,
		"tit": "Phần 37",
		"url": [""],
		"dur": "35:10"
	  },
	  {
		"stt": 38,
		"tit": "Phần 38",
		"url": [""],
		"dur": "41:35"
	  },
	  {
		"stt": 39,
		"tit": "Phần 39",
		"url": [""],
		"dur": "21:23"
	  },
	  {
		"stt": 40,
		"tit": "Phần 40",
		"url": [""],
		"dur": "26:27"
	  }
	]},
	
	{
	  "title": "Hỏa ngục",
	  "eTitle": "Inferno",
	  "author": "Dan Brown",
	  "type": "Phiêu lưu",
	  "mc": "Lưu Hà (Thế Vinh) & Phạm Vân",
	  "cover": "https://upload.wikimedia.org/wikipedia/vi/4/4e/Bia_Hoa_nguc.jpg",
	  "ssrc": [
		"https://www.lachoncoc.com/2014/12/hoa-nguc-danbrow.html",
		"https://archive.org/details/6454645","https://archive.org/details/4356345201606"
	  ],
	  "grp": ["DBR.TAP4$11", "DBR.RLD", "DBR.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/<*~~*>.mp3"
		  }
		]
	  },
	  "year": 2014,
	  "intro": "Nếu như ở các cuốn tiểu thuyết trước Dan Brown sử dụng những kiến thức phong phú về nghệ thuật, biểu tượng tôn giáo, văn hóa để tạo ra câu chuyện trinh thám đơn thuần, thì ở Hỏa ngục, ông gắn câu chuyện với một vấn đề thời sự mang tính toàn cầu: Tình trạng quá tải dân số.<br/>Cuốn sách dày gần 700 trang mô tả cuộc chạy đua diễn ra trong vòng 24 giờ của Robert và Sienna để lần theo những bí ẩn sinh tử. Đó là những cuộc đấu trí nhằm tìm ra lời giải mật mã chống lại lời nguyền diệt vong.<br/>Nhân vật chính trong Hỏa ngục vẫn là giáo sư biểu tượng học Robert Langdon của Mật mã Da Vinci, Thiên thần và Ác quỷ, Biểu tượng thất truyền. Trong Hỏa ngục, Robert tỉnh dậy tại một bệnh viện, đầu đau dữ dội và cơ thể tê liệt, không có chút ký ức về quãng thời gian 36 tiếng vừa qua. Hàng trăm thắc mắc bủa vây Robert, anh không lý giải được tại sao mình lại bất tỉnh trong bệnh viện, tại sao bị bắn, tại sao trên cổ áo lại có một chiếc máy chiếu tí hon có thể tạo ra bức họa Vực địa ngục của danh họa Botticelli, một bản đồ địa ngục với những cảnh giết chóc mà Dante Alighieri đã mô tả trong trường ca Thần khúc...",
		  "parts": [
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": ["6454645/01"],
		"dur": "28:02"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": ["6454645/02"],
		"dur": "34:04"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": ["6454645/03"],
		"dur": "22:08"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": ["6454645/04"],
		"dur": "19:12"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": ["6454645/05"],
		"dur": "29:12"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": ["6454645/06"],
		"dur": "26:35"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": ["6454645/07"],
		"dur": "26:01"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": ["6454645/08"],
		"dur": "39:56"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": ["6454645/09"],
		"dur": "34:40"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": ["6454645/10"],
		"dur": "34:17"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": ["6454645/11"],
		"dur": "20:20"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": ["6454645/12"],
		"dur": "28:18"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": ["6454645/13"],
		"dur": "29:52"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": ["6454645/14"],
		"dur": "55:27"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": ["4356345201606/15"],
		"dur": "28:05"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": ["4356345201606/16"],
		"dur": "19:17"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": ["4356345201606/17"],
		"dur": "30:51"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": ["4356345201606/18"],
		"dur": "23:03"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": ["4356345201606/19"],
		"dur": "24:44"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": ["4356345201606/20"],
		"dur": "27:57"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": ["4356345201606/21"],
		"dur": "19:54"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": ["4356345201606/22"],
		"dur": "21:47"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": ["4356345201606/23"],
		"dur": "22:57"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": ["4356345201606/24"],
		"dur": "17:57"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": ["4356345201606/25"],
		"dur": "30:22"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": ["4356345201606/26"],
		"dur": "27:31"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": ["4356345201606/27"],
		"dur": "34:15"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": ["4356345201606/28"],
		"dur": "20:09"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": ["4356345201606/29"],
		"dur": "27:16"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": ["4356345201606/30"],
		"dur": "18:47"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": ["4356345201606/31"],
		"dur": "26:04"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": ["4356345201606/32"],
		"dur": "22:31"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": ["4356345201606/33"],
		"dur": "26:12"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": ["4356345201606/34"],
		"dur": "19:19"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": ["4356345201606/35"],
		"dur": "18:48"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": ["4356345201606/36"],
		"dur": "28:53"
	  },
	  {
		"stt": 37,
		"tit": "Phần 37",
		"url": ["4356345201606/37"],
		"dur": "20:55"
	  },
	  {
		"stt": 38,
		"tit": "Phần 38",
		"url": ["4356345201606/38"],
		"dur": "22:04"
	  },
	  {
		"stt": 39,
		"tit": "Phần 39",
		"url": ["4356345201606/39"],
		"dur": "23:02"
	  },
	  {
		"stt": 40,
		"tit": "Phần 40",
		"url": ["4356345201606/40"],
		"dur": "18:36"
	  },
	  {
		"stt": 41,
		"tit": "Phần 41",
		"url": ["4356345201606/41"],
		"dur": "20:16"
	  },
	  {
		"stt": 42,
		"tit": "Phần 42",
		"url": ["4356345201606/42"],
		"dur": "18:30"
	  },
	  {
		"stt": 43,
		"tit": "Phần 43",
		"url": ["4356345201606/43"],
		"dur": "10:43"
	  },
	  {
		"stt": 44,
		"tit": "Phần 44",
		"url": ["4356345201606/44"],
		"dur": "28:39"
	  },
	  {
		"stt": 45,
		"tit": "Phần 45",
		"url": ["4356345201606/45"],
		"dur": "28:55"
	  },
	  {
		"stt": 46,
		"tit": "Phần 46",
		"url": ["4356345201606/46(End)"],
		"dur": "18:53"
	  }
	]},
	
	{
	  "title": "Nguồn cội",
	  "eTitle": "Origin",
	  "author": "Dan Brown",
	  "type": "Phiêu lưu",
	  "mc": "Lưu Hà",
	  "cover": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhylvHNZ1zmnm9H1pC70LcuuxjhyphenhyphenvVSCx4TLj4HRrOGh6CgJOynWEbaDKukpPYJrgBq9UxlfCWhjcS8Z9z7-Q-eGAvpZmix6CflaBjcAeNSJfaYhmbpOfO4pr0aBoCsk-Na51svl_DYlbw/s640/img581.gif",
	  "ssrc": [
		"https://www.lachoncoc.com/2018/05/du-sieu-pham-truyen-audio-nguon-coi.html",
		"https://archive.org/details/05Chuong0608","https://archive.org/details/39Chuong103105END"
	  ],
	  "grp": ["DBR.TAP5$11", "DBR.RLD", "DBR.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/<*~~*>.mp3"
		  },
		  {
			"urlLine": 1,
			"nd": 2,
			"wcSrc": "https://drive.google.com/open?id=<*~~*>"
		  }
		]
	  },
	  "year": 2017,
	  "intro": "Nguồn cội là một cuốn tiểu thuyết kinh dị, bí ẩn, năm 2017 của tác giả người Mỹ Dan Brown. và phần thứ năm trong series Robert Langdon của ông, tiếp theo của Thiên thần & Ác quỷ, Mật mã Da Vinci, Biểu tượng thất truyền và Hỏa ngục. Cuốn sách được phát hành vào ngày 3 tháng 10 năm 2017 bởi Doubleday.<br/>Robert Langdon, giáo sư biểu tượng và biểu tượng tôn giáo đến từ trường đại học Harvard, đã tới Bảo tàng Guggenheim Bilbao để tham dự một sự kiện quan trọng - công bố một phát hiện 'sẽ thay đổi bộ mặt khoa học mãi mãi'.<br/>Edmond Kirsch là một tỷ phú bốn mươi tuổi, một nhà tiên tri. Những phát minh kỹ thuật cao và những dự đoán táo bạo đã làm cho anh trở thành một nhân vật nổi tiếng toàn cầu. Kirsch - cũng chính là một trong những sinh viên đầu tiên của Langdon tại đại học Harvard cách đây hai thập kỷ - sẽ tiết lộ một bước đột phá đáng kinh ngạc.<br/>Nó sẽ trả lời hai câu hỏi cơ bản về sự tồn tại của con người:'Chúng ta đến từ đâu?' và 'Chúng ta đang đi về đâu?'",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": ["05Chuong0608/[01]phan dau", "1U3PRISsI6vGZImMr2gIQ-6wAXsm_vWh6"],
		"dur": "24:18"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": ["05Chuong0608/[02]Chuong 01", "12aNWlQkjDumlDOUSZbMamUWU5AdCGMZX"],
		"dur": "20:28"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": ["05Chuong0608/[03]Chuong 02", "188EXQ1W32MgCwZitjuC6uiijydT_YnXj"],
		"dur": "18:38"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": [
		  "05Chuong0608/[04]Chuong 03-05"    ,
		  "1fUSkgTWtqE4VorUalUGx5Wy7JLiOFCC0"
		],
		"dur": "32:28"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": [
		  "05Chuong0608/[05]Chuong 06-08"    ,
		  "1bmYvu5onS4eJEzubRqurbizalDiA7NBm"
		],
		"dur": "44:52"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": [
		  "05Chuong0608/[06]Chuong 09-11"    ,
		  "1x5-me8yCM35SjoR-jZMX9Z3FbxlE890j"
		],
		"dur": "34:36"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": [
		  "05Chuong0608/[07]Chuong 12-14"    ,
		  "1JAp3ubTOCHhpF71MgbXrET6vQL-s7LWl"
		],
		"dur": "25:49"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": [
		  "05Chuong0608/[08]Chuong 15-18"    ,
		  "17_FMibsytZhHEqTs3nmBUFsVHIgJpTeN"
		],
		"dur": "44:21"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": [
		  "05Chuong0608/[09]Chuong 19-21"    ,
		  "1nGiZKAG2kC31PigEGVjBvj_fl2nnxYsL"
		],
		"dur": "39:17"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": [
		  "05Chuong0608/[10]Chuong 22-24"    ,
		  "1yxyMgst6bAPtkNqjz9sRIKDi9UyZaSF7"
		],
		"dur": "36:53"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": [
		  "05Chuong0608/[11]Chuong 25-27"    ,
		  "1s03aOyM33EttdT54HFs2Y4h3NVnaP4vg"
		],
		"dur": "29:14"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": [
		  "05Chuong0608/[12]Chuong 28-30"    ,
		  "1b_3r0omt0A942-Ze5pFrS2yj4sgoOBTY"
		],
		"dur": "31:35"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": [
		  "05Chuong0608/[13]Chuong 31-33"    ,
		  "1TEkIGmv2Re25wQqbHzz2CifH24ljQyfB"
		],
		"dur": "34:02"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": [
		  "05Chuong0608/[14]Chuong 34-36"    ,
		  "1FDcev2d3aQcFs9pjM5YbrNkbgET2gcEP"
		],
		"dur": "34:45"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": [
		  "05Chuong0608/[15]Chuong 37-39"    ,
		  "1cMRCggQwkYfeCay5ijz8YG-5VIL0NlSy"
		],
		"dur": "29:22"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": [
		  "05Chuong0608/[16]Chuong 40-42"    ,
		  "1YkNDsgq4GBcZdBNH36cuV3m3fWAz_DFt"
		],
		"dur": "33:39"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": [
		  "05Chuong0608/[17]Chuong 43-44"    ,
		  "1qM6lUDBqSAZzbj99CSHj7_Tr87F5Qg4e"
		],
		"dur": "37:53"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": [
		  "05Chuong0608/[18]Chuong 45-47"    ,
		  "1Q2FW6xMtr3b2JOTI8zmeUo-oqW3oh6eN"
		],
		"dur": "23:42"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": [
		  "05Chuong0608/[19]Chuong 48-49"    ,
		  "1ahwu4QObfliJ6WTaRSZMT0DDGjbEwdO3"
		],
		"dur": "34:46"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": [
		  "05Chuong0608/[20]Chuong 50-51"    ,
		  "1KuzcgDAyY09z3-9WTpobKm-lKNt0yJcz"
		],
		"dur": "32:43"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": [
		  "05Chuong0608/[21]Chuong 52-53"    ,
		  "1zefzOn4I8t8Zte4vRsG_1en07kAtek3Y"
		],
		"dur": "37:25"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": [
		  "05Chuong0608/[22]Chuong 54-56"    ,
		  "1mWE9kdP7vBdBYGZ4lgmFm3SZQ7SshM0y"
		],
		"dur": "26:28"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": [
		  "05Chuong0608/[23]Chuong 57-59"    ,
		  "1Oqopwtauc5mi-Nyxiie1yj-_0OTdZ5Bu"
		],
		"dur": "35:43"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": [
		  "05Chuong0608/[24]Chuong 60-61"    ,
		  "183ec6LIVo8yaQnZyAE-yhKuuyR8Rzrtj"
		],
		"dur": "31:11"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": [
		  "39Chuong103105END/[25]Chuong 62-64",
		  "1vJMcBWmvTGla6jhuOf3LYm6nQAw0myFv"
		],
		"dur": "31:05"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": [
		  "39Chuong103105END/[26]Chuong 65-67",
		  "1iAsqCVS6Aqie2Bv-k1zXWwsv5sbvFzzo"
		],
		"dur": "30:28"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": [
		  "39Chuong103105END/[27]Chuong 68-70",
		  "1rJz2RFZJK5k08KHT7RlOyveH_Bhwp5Q2"
		],
		"dur": "33:43"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": [
		  "39Chuong103105END/[28]Chuong 71-73",
		  "1mTaY-pvfotVOgqjh6wx_GxG2GK5yXQr4"
		],
		"dur": "31:25"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": [
		  "39Chuong103105END/[29]Chuong 74-76",
		  "1LdX4nZexI54o_Lw9SlQ-JQBBwpEOBeOV"
		],
		"dur": "35:34"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": [
		  "39Chuong103105END/[30]Chuong 77-79",
		  "1X6mqPPH4zN2oQJhiiOeSrRf9aHeLsr4u"
		],
		"dur": "16:24"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": [
		  "39Chuong103105END/[31]Chuong 80-82",
		  "1OhiF_jTqjHP9oog7f2AvcAtMXUPxGBgu"
		],
		"dur": "26:03"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": [
		  "39Chuong103105END/[32]Chuong 83-86",
		  "1pEEyAtbf0vz07942u68GqAH1weh3RJC5"
		],
		"dur": "33:22"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": [
		  "39Chuong103105END/[33]Chuong 87-89",
		  "1NYvdFlMe-fd8IoYvjf9stJtx40tIR0S8"
		],
		"dur": "30:54"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": [
		  "39Chuong103105END/[34]Chuong 90-91",
		  "1hAadqDEVBeGXtNt5_bJ1jeKtNMBCirO0"
		],
		"dur": "33:40"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": [
		  "39Chuong103105END/[35]Chuong 92-94",
		  "1F4MZlNMHzWcNyS2Hx3oOrqzQ19XqypRn"
		],
		"dur": "28:13"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": [
		  "39Chuong103105END/[36]Chuong 95-96",
		  "1AkWyP7Yrzwss8KiBHw2B1HfLROvUxn2t"
		],
		"dur": "35:52"
	  },
	  {
		"stt": 37,
		"tit": "Phần 37",
		"url": [
		  "39Chuong103105END/[37]Chuong 97-98",
		  "1smZ1HQdi3sWeQLuL4oMvJyEcsih0iGSm"
		],
		"dur": "34:10"
	  },
	  {
		"stt": 38,
		"tit": "Phần 38",
		"url": [
		  "39Chuong103105END/[38]Chuong 99-102",
		  "1FMbeIhuP-7hLLu6qnAZ4UrdJ-WBwZSWE"
		],
		"dur": "34:31"
	  },
	  {
		"stt": 39,
		"tit": "Phần 39",
		"url": [
		  "39Chuong103105END/[39]Chuong 103-105 (END)",
		  "1DykebhM2-mZa5uSL0gAXgomF4KdQKkrj"
		],
		"dur": "54:57"
	  }
	]},
	
	{
	  "title": "Pháo đài số",
	  "eTitle": "Digital Fortress",
	  "author": "Dan Brown",
	  "type": "Phiêu lưu",
	  "mc": "Thế Vinh",
	  "cover": "https://upload.wikimedia.org/wikipedia/vi/1/1b/Ph%C3%A1o_%C4%91%C3%A0i_s%E1%BB%91.JPG",
	  "ssrc": [
		"https://www.lachoncoc.com/2015/03/truyen-audio-trinh-tham-hanh-ong-hot.html",
		"https://archive.org/details/PhaoDaiSo21kjdfhkjshfkhs", "https://archive.org/details/PhaoDaiSo21kjdfhkjshfkhs_201503", "https://archive.org/details/PhaoDaiSo31"
	  ],
	  "grp": ["DBR.TAPA$12", "DBR.TTK", "DBR.MMC"],
	  "wc": {
		"url": [
		  {
			"urlLine": 0,
			"nd": 2,
			"wcSrc": "https://archive.org/download/thienthanvaacquy15/thienthanvaacquy<*~~*>.mp3"
		  }
		]
	  },
	  "year": 1998,
	  "intro": "Pháo đài số là tác phẩm đầu tay của Dan Brown và nó đã chinh phục được độc giả của trên 40 nước bởi một lẽ giản dị: nhiều tình tiết ly kỳ, hấp dẫn mang tính giải trí cao. Cái tài của Dan Brown trong Pháo đài số là thông qua những tình huống phức tạp, tốc độ tư duy nhanh giống như phim hành động Mỹ, ông đã cố gắng tiếp cận những vấn đề tự do cá nhân của thời đại số hoá: Con người sẽ ra sao nếu tất cả mọi hành vi sống đều bị kiểm soát? Tương lai của nhân loại sẽ rất ảm đạm và nhanh chóng đi đến kết cục huỷ diệt nếu không còn gì được coi là riêng tư, bí ẩn nữa.<br/>Khi cỗ máy bẻ khóa mật mã dường như bất khả chiến bại của mình gặp phải một đoạn mã bí hiểm không thể phá vỡ, NSA phải cho gọi trưởng nhóm chuyên gia giải mã Susan Fletcher, một nhà toán học rất xinh đẹp và thông minh tới. Điều Susan khám phá ra sau đó đã gây sốc cho giới quyền lực: NSA đang bị đe dọa, không phải bằng súng hay bom mà là bằng một đoạn mã cực kỳ phức tạp mà nếu để phát tán ra sẽ có thể làm sụp đổ tòa bộ ngành tình báo Hoa Kỳ.<br/>Đứng giữa một thế giới ngổn ngang những bí mật và dối trá, Susan Fletcher phải chiến đấu để cứu lấy tổ chức mà cô tin tưởng. Khi biết minh bị gần như tất cả mọi người xung quanh phản bội, cô lao vào cuộc chiến không chỉ vì đất nước mà còn vì tính mạng của bản thân và vì tính mạng của người mà cô yêu.<br/>Từ những hành lang tàu điện ngầm ở Hoa Kỳ cho tới những ngôi nhà chọc trời ở Tokyo tới những mái nhà thờ ở Tây Ban Nha, một cuộc đua không cân sức đã bắt đầu diễn ra. Đó là một cuộc chiến sống còn nhằm ngăn chặn việc tạo ra một thế lực không thể đánh bại - một công thức viết ra các đoạn mã không thể phá vỡ đang đe dọa làm mất cân bằng cán cân quyền lực mà thế giới đạt được từ sau thời kỳ chiến tranh lạnh. Và phá vỡ mãi mãi.",
	  "parts": [
	  {
		"stt": 1,
		"tit": "Phần 1",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 01"],
		"dur": "30:57"
	  },
	  {
		"stt": 2,
		"tit": "Phần 2",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 02"],
		"dur": "31:06"
	  },
	  {
		"stt": 3,
		"tit": "Phần 3",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 03"],
		"dur": "24:45"
	  },
	  {
		"stt": 4,
		"tit": "Phần 4",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 04"],
		"dur": "24:39"
	  },
	  {
		"stt": 5,
		"tit": "Phần 5",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 05"],
		"dur": "16:52"
	  },
	  {
		"stt": 6,
		"tit": "Phần 6",
		"url": ["21kjdfhkjshfkhs/Phao Dai So 06"],
		"dur": "19:06"
	  },
	  {
		"stt": 7,
		"tit": "Phần 7",
		"url": ["21kjdfhkjshfkhs/phao dai so 07"],
		"dur": "21:27"
	  },
	  {
		"stt": 8,
		"tit": "Phần 8",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 08"],
		"dur": "18:43"
	  },
	  {
		"stt": 9,
		"tit": "Phần 9",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 09"],
		"dur": "22:07"
	  },
	  {
		"stt": 10,
		"tit": "Phần 10",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 10"],
		"dur": "15:17"
	  },
	  {
		"stt": 11,
		"tit": "Phần 11",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 11"],
		"dur": "19:16"
	  },
	  {
		"stt": 12,
		"tit": "Phần 12",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 12"],
		"dur": "22:59"
	  },
	  {
		"stt": 13,
		"tit": "Phần 13",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 13"],
		"dur": "29:43"
	  },
	  {
		"stt": 14,
		"tit": "Phần 14",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 14"],
		"dur": "18:34"
	  },
	  {
		"stt": 15,
		"tit": "Phần 15",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 15"],
		"dur": "27:43"
	  },
	  {
		"stt": 16,
		"tit": "Phần 16",
		"url": ["21kjdfhkjshfkhs_201503/phao dai so 16"],
		"dur": "20:16"
	  },
	  {
		"stt": 17,
		"tit": "Phần 17",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 17fdhgdgsgd"],
		"dur": "22:14"
	  },
	  {
		"stt": 18,
		"tit": "Phần 18",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 18dfdfhtrbblho"],
		"dur": "21:41"
	  },
	  {
		"stt": 19,
		"tit": "Phần 19",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 19dgarewrtefer"],
		"dur": "20:15"
	  },
	  {
		"stt": 20,
		"tit": "Phần 20",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 20sdghgfgfxbrfrtigb"],
		"dur": "20:04"
	  },
	  {
		"stt": 21,
		"tit": "Phần 21",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 21kjdfhkjshfkhs"],
		"dur": "24:40"
	  },
	  {
		"stt": 22,
		"tit": "Phần 22",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 22fdshjryyryti"],
		"dur": "16:21"
	  },
	  {
		"stt": 23,
		"tit": "Phần 23",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 23regtyytrgdgf"],
		"dur": "28:43"
	  },
	  {
		"stt": 24,
		"tit": "Phần 24",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 24gnZfewhyukjfk"],
		"dur": "20:11"
	  },
	  {
		"stt": 25,
		"tit": "Phần 25",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 25hgerttryifbcfsg"],
		"dur": "32:46"
	  },
	  {
		"stt": 26,
		"tit": "Phần 26",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 26ghgsfwhckyg"],
		"dur": "20:57"
	  },
	  {
		"stt": 27,
		"tit": "Phần 27",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 27qeweutyjvzdg"],
		"dur": "16:58"
	  },
	  {
		"stt": 28,
		"tit": "Phần 28",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 28fsffdsgtyhggfgr"],
		"dur": "17:01"
	  },
	  {
		"stt": 29,
		"tit": "Phần 29",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 29dfdghdgdhrtyeu"],
		"dur": "15:14"
	  },
	  {
		"stt": 30,
		"tit": "Phần 30",
		"url": ["21kjdfhkjshfkhs_201503/Phao Dai So 30ghtytrurefsdghjvxjmy"],
		"dur": "22:22"
	  },
	  {
		"stt": 31,
		"tit": "Phần 31",
		"url": ["31/Phao Dai So 31"],
		"dur": "22:09"
	  },
	  {
		"stt": 32,
		"tit": "Phần 32",
		"url": ["31/Phao Dai So 32"],
		"dur": "20:28"
	  },
	  {
		"stt": 33,
		"tit": "Phần 33",
		"url": ["31/phao dai so 33-chuong 116_2"],
		"dur": "12:33"
	  },
	  {
		"stt": 34,
		"tit": "Phần 34",
		"url": ["31/phao dai so 34 (chuong 123)_2"],
		"dur": "23:44"
	  },
	  {
		"stt": 35,
		"tit": "Phần 35",
		"url": ["31/phao dai so 35 (chuong 127)_2"],
		"dur": "25:55"
	  },
	  {
		"stt": 36,
		"tit": "Phần 36",
		"url": ["31/phao dai so 36(end)_2"],
		"dur": "08:37"
	  }
	]}

]};