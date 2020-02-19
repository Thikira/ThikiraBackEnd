import { DBService, Group, Menu, MenuCategory, Option, Restaurant } from '@app/db';
import {
  DtoEditGroup, DtoEditMenu, DtoEditMenuCategory, DtoEditOption,
  DtoGetGroupList, DtoGetMenuList, DtoGetOptionList,
  DtoUploadGroup, DtoUploadMenu, DtoUploadMenuCategory, DtoUploadOption,
} from '@app/dto';
import {
  ResGetGroup, ResGetMenu, ResGetMenuCategory, ResGetOption,
  ResUploadGroup, ResUploadMenu, ResUploadMenuCategory, ResUploadOption,
} from '@app/res';
import { UtilService } from '@app/util';
import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class MenuService {
  constructor(private readonly db_service: DBService,
              private readonly util_service: UtilService,
  ) {
  }

  public async upload_menu_category(token: string, payload: DtoUploadMenuCategory): Promise<ResUploadMenuCategory> {
    const email: string = await this.util_service.get_email_by_token(token);
    const found_restaurant: Restaurant = await this.db_service.find_restaurant_by_email(email);
    const found_menu_category: MenuCategory = await this.db_service.find_menu_category_by_name(payload.name, found_restaurant);
    if (!found_menu_category.is_empty()) {
      throw new ConflictException();
    }

    const menu_category: MenuCategory = new MenuCategory(payload, found_restaurant);
    await this.db_service.insert_menu_category(menu_category);
    return { mc_id: menu_category.mc_id };
  }

  public async get_menu_category(menu_category_id: number): Promise<ResGetMenuCategory> {
    const found_menu_category: MenuCategory = await this.db_service.find_menu_category_by_id(menu_category_id);
    return new ResGetMenuCategory({
      mc_id: found_menu_category.mc_id,
      name: found_menu_category.mc_name,
    });
  }

  public async get_menu_category_list(token: string): Promise<ResGetMenuCategory[]> {
    const email: string = await this.util_service.get_email_by_token(token);
    const found_restaurant: Restaurant = await this.db_service.find_restaurant_by_email(email);

    const found_menu_category: MenuCategory[] = await this.db_service.find_menu_categories_by_restaurant(found_restaurant);
    const result: ResGetMenuCategory[] = new Array<ResGetMenuCategory>();
    for (const loop_menu_category of found_menu_category) {
      result.push(new ResGetMenuCategory({
        mc_id: loop_menu_category.mc_id,
        name: loop_menu_category.mc_name,
      }));
    }
    return result;
  }

  public async edit_menu_category(payload: DtoEditMenuCategory): Promise<void> {
    await this.db_service.update_menu_category(payload.mc_id, { mc_name: payload.name });
  }

  public async remove_menu_category(param: number[]): Promise<void> {
    for (const loop_id of param) {
      const found_menu_category: MenuCategory = await this.db_service.find_menu_category_by_id(loop_id);
      const found_menus: Menu[] = await this.db_service.find_menus_by_menu_category(found_menu_category);
      if (found_menus.length !== 0) {
        const m_ids: number[] = new Array<number>();
        for (const loop_menu of found_menus) {
          m_ids.push(loop_menu.m_id);
        }
        await this.remove_menu(m_ids);
      }
    }
    await this.db_service.delete_menu_category(param);
  }

  public async upload_menu(payload: DtoUploadMenu): Promise<ResUploadMenu> {
    const found_menu_category: MenuCategory = await this.db_service.find_menu_category_by_id(payload.mc_id);
    const found_menu: Menu = await this.db_service.find_menu_by_name(payload.name, found_menu_category);
    if (!found_menu.is_empty()) {
      throw new ConflictException();
    }

    const menu: Menu = new Menu(payload, found_menu_category);
    await this.db_service.insert_menu(menu);

    if (payload.group !== undefined && payload.group !== null) {
      const groups: Group[] = new Array<Group>();
      for (const loop_group of payload.group) {
        groups.push(new Group(loop_group, menu));
      }
      await this.db_service.insert_group(groups);

      const options: Option[] = new Array<Option>();
      for (const index of UtilService.range(payload.group)) {
        if (payload.group[index].option !== undefined && payload.group[index].option !== null) {
          for (const index_2 of UtilService.range((payload.group[index].option))) {
            options.push(new Option(payload.group[index].option[index_2], groups[index]));
          }
        }
      }
      if (options.length !== 0) {
        await this.db_service.insert_option(options);
      }
    }
    return { m_id: menu.m_id };
  }

  public async get_menu(menu_id: number): Promise<ResGetMenu> {
    const found_menu: Menu = await this.db_service.find_menu_by_id(menu_id);
    return new ResGetMenu(found_menu);
  }

  public async get_menu_list(payload: DtoGetMenuList): Promise<ResGetMenu[]> {
    const found_menu_category: MenuCategory = await this.db_service.find_menu_category_by_id(payload.mc_id);
    return await this.db_service.find_menus_groups_options(found_menu_category);
  }

  public async edit_menu(payload: DtoEditMenu): Promise<void> {
    const edit_data = {
      m_name: payload.name,
      m_price: payload.price,
      m_description: payload.description,
      m_image: payload.image,
    };
    for (const key of Object.keys(edit_data)) {
      if (edit_data[key] === undefined || edit_data[key] === null) {
        delete edit_data[key];
      }
    }
    await this.db_service.update_menu(payload.m_id, edit_data);
  }

  public async remove_menu(param: number[]): Promise<void> {
    for (const loop_id of param
      ) {
      const found_menu: Menu = await this.db_service.find_menu_by_id(loop_id);
      const found_groups: Group[] = await this.db_service.find_groups_by_menu(found_menu);
      if (found_groups.length !== 0) {
        const g_ids: number[] = new Array<number>();
        for (const loop_group of found_groups) {
          g_ids.push(loop_group.g_id);
        }
        await this.remove_group(g_ids);
      }
    }
    await this.db_service.delete_menu(param);
  }

  public async upload_group(payload: DtoUploadGroup): Promise<ResUploadGroup> {
    const found_menu: Menu = await this.db_service.find_menu_by_id(payload.m_id);
    const found_group: Group = await this.db_service.find_group_by_name(payload.name, found_menu);
    if (!found_group.is_empty()) {
      throw new ConflictException();
    }
    const group: Group = new Group(payload, found_menu);

    await this.db_service.insert_group(group);

    return { g_id: group.g_id };
  }

  public async get_group(group_id: number): Promise<ResGetGroup> {
    const found_group: Group = await this.db_service.find_group_by_id(group_id);
    return new ResGetGroup(found_group);
  }

  public async get_group_list(payload: DtoGetGroupList): Promise<ResGetGroup[]> {
    const found_menu: Menu = await this.db_service.find_menu_by_id(payload.m_id);
    const result: ResGetGroup[] = new Array<ResGetGroup>();
    const found_groups: Group[] = await this.db_service.find_groups_and_options(found_menu);

    for (const loop_group of found_groups) {
      const group: ResGetGroup = new ResGetGroup(loop_group);
      result.push(group);
      for (const loop_option of loop_group.option) {
        const option: ResGetOption = new ResGetOption(loop_option);
        group.option.push(option);
      }
    }
    return result;
  }

  public async edit_group(payload: DtoEditGroup): Promise<void> {
    const edit_data = {
      g_name: payload.name,
      g_max_count: payload.max_count,
    };
    for (const key of Object.keys(edit_data)) {
      if (edit_data[key] === undefined || edit_data[key] === null) {
        delete edit_data[key];
      }
    }
    await this.db_service.update_group(payload.g_id, edit_data);
  }

  public async remove_group(param: number[]): Promise<void> {
    for (const loop_id of param
      ) {
      const found_group: Group = await this.db_service.find_group_by_id(loop_id);
      const found_options: Option[] = await this.db_service.find_options_by_group(found_group);
      if (found_options.length !== 0) {
        const o_ids: number[] = new Array<number>();
        for (const loop_option of found_options) {
          o_ids.push(loop_option.o_id);
        }
        await this.remove_option(o_ids);
      }
    }
    await this.db_service.delete_group(param);
  }

  public async upload_option(payload: DtoUploadOption): Promise<ResUploadOption> {
    const found_group: Group = await this.db_service.find_group_by_id(payload.g_id);
    const found_option: Option = await this.db_service.find_option_by_name(payload.name, found_group);
    if (!found_option.is_empty()) {
      throw new ConflictException();
    }
    const option: Option = new Option(payload, found_group);
    await this.db_service.insert_option(option);
    return { o_id: option.o_id };
  }

  public async get_option(option_id: number): Promise<ResGetOption> {
    const found_option: Option = await this.db_service.find_option_by_id(option_id);
    return new ResGetOption(found_option);
  }

  public async get_option_list(payload: DtoGetOptionList): Promise<ResGetOption  []> {
    const found_group: Group = await this.db_service.find_group_by_id(payload.g_id);
    const result: ResGetOption[] = new Array<ResGetOption>();
    const found_options: Option[] = await this.db_service.find_options_by_group(found_group);

    for (const loop_option of found_options) {
      const option: ResGetOption = new ResGetOption(loop_option);
      result.push(option);
    }

    return result;
  }

  public async edit_option(payload: DtoEditOption): Promise<void> {
    const edit_data = {
      o_name: payload.name,
      o_price: payload.price,
    };
    for (const key of Object.keys(edit_data)) {
      if (edit_data[key] === undefined || edit_data[key] === null) {
        delete edit_data[key];
      }
    }
    await this.db_service.update_option(payload.o_id, edit_data);
  }

  public async remove_option(param: number[]): Promise<void> {
    await this.db_service.delete_option(param);
  }
}
