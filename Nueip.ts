import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import FormData from "form-data";
import moment from "moment";
import * as cheerio from "cheerio";

class Nueip {
  private client: AxiosInstance;
  private user: Checkout.User;

  constructor(user: Checkout.User) {
    const jar = new CookieJar();
    const client = wrapper(
      axios.create({
        jar,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
          origin: "https://cloud.nueip.com",
        },
      })
    );

    this.client = client;
    this.user = user;
  }

  public login() {
    const data = new FormData();
    data.append("inputCompany", "Accuhit");
    data.append("inputID", this.user.username);
    data.append("inputPassword", this.user.password);
    return this.client.post("https://cloud.nueip.com/login/index/param", data);
  }

  public async getRecords() {
    const data = new FormData();
    // action=attendance&loadInBatch=1&loadBatchGroupNum=1000&loadBatchNumber=1&work_status=1,4
    data.append("action", "attendance");
    data.append("loadInBatch", "1");
    data.append("loadBatchGroupNum", "1000");
    data.append("loadBatchNumber", "1");
    data.append("work_status", "1,4");
    const result = await this.client.post(
      "https://cloud.nueip.com/attendance_record/ajax",
      data
    );

    return result.data;
  }

  public async offpunch() {
    const data = new FormData();
    // action=add&id=2&attendance_time=2022-11-02 18:30:17&token=5eb5dd5445e09fc208f86f2ea279e6b2d83c7183dd5271473e41b1090e89cf04&lat=25.0479147&lng=121.5483592
    const token = await this.getPunchToken();
    data.append("action", "add");
    data.append("id", "2");
    data.append("attendance_time", moment().format("YYYY-MM-DD HH:mm:ss"));
    data.append("token", token);
    const { lat, lng } = getRandomPosition();
    data.append("lat", lat);
    data.append("lng", lng);
    const result = await this.client.post(
      "https://cloud.nueip.com/time_clocks/ajax",
      data
    );
    return result.data;
  }

  public async onpunch() {
    const data = new FormData();
    // action=add&id=2&attendance_time=2022-11-02 18:30:17&token=5eb5dd5445e09fc208f86f2ea279e6b2d83c7183dd5271473e41b1090e89cf04&lat=25.0479147&lng=121.5483592
    const token = await this.getPunchToken();
    data.append("action", "add");
    data.append("id", "1");
    data.append("attendance_time", moment().format("YYYY-MM-DD HH:mm:ss"));
    data.append("token", token);
    const { lat, lng } = getRandomPosition();
    data.append("lat", lat);
    data.append("lng", lng);
    const result = await this.client.post(
      "https://cloud.nueip.com/time_clocks/ajax",
      data
    );
    return result.data;
  }

  private async getPunchToken(): Promise<string> {
    const { data: body } = await this.client.get(
      "https://cloud.nueip.com/home"
    );
    const $ = cheerio.load(body);
    const token = $("input[name=token]").val();

    return token as string;
  }
}

function getRandomPosition() {
  const lat = 25.0479147 + (Math.random() * 0.01).toFixed(6);
  const lng = 121.5483592 + (Math.random() * 0.01).toFixed(6);

  return { lat, lng };
}

export default Nueip;
